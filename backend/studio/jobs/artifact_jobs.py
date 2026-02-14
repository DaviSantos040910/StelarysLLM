import logging
import json
import time
from django.utils import timezone
from django_rq import job
from rq import Retry

from studio.models import KnowledgeArtifact
from studio.services.source_assembler import SourceAssemblyService
from studio.services.podcast_scripting import PodcastScriptingService
from studio.services.audio_mixer import AudioMixerService
from chat.services.ai_client import get_ai_client
from studio.schemas import QUIZ_SCHEMA, FLASHCARD_SCHEMA, SUMMARY_SCHEMA, SLIDE_SCHEMA
from google.genai import types
from core.genai_models import GENAI_MODEL_TEXT
from core.perf import log_perf, now_ms, ms_since
from rq import get_current_job

logger = logging.getLogger(__name__)

def _p(msg):
    print(msg, flush=True)

@job('default', timeout=360, result_ttl=86400, retry=Retry(max=3))
def generate_artifact_job(artifact_id, options):
    job = get_current_job()
    job_id = job.id if job else 'unknown'
    t0 = time.perf_counter()
    t_start = now_ms()

    _p(f"[JOB_START] artifact_id={artifact_id} job_id={job_id} payload_keys={list(options.keys())} elapsed_ms=0")
    log_perf("artifact.job_start", artifact_id, job_id=job_id)

    try:
        artifact = KnowledgeArtifact.objects.get(id=artifact_id)
        owner_id = artifact.chat.user.id if artifact.chat.user else (artifact.chat.guest_session.id if artifact.chat.guest_session else 'unknown')
        _p(f"[JOB_DETAILS] artifact_type={artifact.type} owner_id={owner_id} chat_id={artifact.chat.id}")

        # Queue Latency
        if artifact.enqueued_at:
            latency_ms = int((timezone.now() - artifact.enqueued_at).total_seconds() * 1000)
            _p(f"[QUEUE_LATENCY] artifact_id={artifact_id} job_id={job_id} queue_latency_ms={latency_ms}")

    except KnowledgeArtifact.DoesNotExist:
        logger.error(f"Artifact {artifact_id} not found.")
        _p(f"[JOB_ERROR] artifact_id={artifact_id} error=Artifact not found")
        log_perf("artifact.job_error", artifact_id, job_id=job_id, error="Artifact not found")
        return

    # Update Start State
    artifact.stage = KnowledgeArtifact.Stage.ASSEMBLING_CONTEXT
    artifact.started_at = timezone.now()
    artifact.attempts += 1
    artifact.save(update_fields=['stage', 'started_at', 'attempts'])

    try:
        # 1. ASSEMBLING CONTEXT
        t_ctx = now_ms()
        t_ctx_perf = time.perf_counter()
        _p(f"[STEP_START] Assembling Context artifact_id={artifact_id}")
        log_perf("artifact.load_sources_start", artifact_id, job_id=job_id)
        config = {
            'selectedSourceIds': options.get('source_ids', []),
            'includeChatHistory': options.get('includeChatHistory', False)
        }
        full_context = SourceAssemblyService.get_context_from_config(
            artifact.chat.id,
            config,
            query=artifact.title
        )
        ctx_ms = int((time.perf_counter() - t_ctx_perf) * 1000)
        _p(f"[STEP_END] Assembling Context artifact_id={artifact_id} elapsed_ms={ctx_ms} context_len={len(full_context)}")
        log_perf("artifact.load_sources_end", artifact_id, job_id=job_id, elapsed_ms=ms_since(t_ctx), context_len=len(full_context))

        # 2. GENERATING CONTENT
        artifact.stage = KnowledgeArtifact.Stage.GENERATING
        artifact.save(update_fields=['stage'])

        t_gen_perf = time.perf_counter()
        _p(f"[STEP_START] Generating Content ({artifact.type}) artifact_id={artifact_id}")

        if artifact.type == KnowledgeArtifact.ArtifactType.PODCAST:
            _generate_podcast(artifact, full_context, options, job_id)
        else:
            _generate_standard_artifact(artifact, full_context, options, job_id)

        gen_ms = int((time.perf_counter() - t_gen_perf) * 1000)
        _p(f"[STEP_END] Generating Content artifact_id={artifact_id} elapsed_ms={gen_ms}")

        # 3. READY
        artifact.stage = KnowledgeArtifact.Stage.READY
        artifact.status = KnowledgeArtifact.Status.READY
        artifact.finished_at = timezone.now()

        t_save_perf = time.perf_counter()
        artifact.save(update_fields=['stage', 'status', 'finished_at', 'media_url', 'duration', 'content'])
        save_ms = int((time.perf_counter() - t_save_perf) * 1000)
        _p(f"[STEP_END] Save Artifact artifact_id={artifact_id} elapsed_ms={save_ms}")

        total_duration = int((time.perf_counter() - t0) * 1000)
        _p(f"[JOB_DONE] artifact_id={artifact_id} job_id={job_id} total_ms={total_duration} status=READY")

        logger.info(f"[{artifact.correlation_id}] Artifact {artifact_id} generated successfully in {total_duration}ms")
        log_perf("artifact.job_done", artifact_id, job_id=job_id, elapsed_ms=total_duration)

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        _p(f"[JOB_ERROR] artifact_id={artifact_id} job_id={job_id} error={str(e)}\n{tb}")

        logger.error(f"[{artifact.correlation_id}] Job failed for artifact {artifact_id}: {e}", exc_info=True)
        log_perf("artifact.job_error", artifact_id, job_id=job_id, error=str(e), elapsed_ms=ms_since(t_start))
        artifact.stage = KnowledgeArtifact.Stage.ERROR
        artifact.status = KnowledgeArtifact.Status.ERROR
        artifact.error_message = str(e)
        artifact.finished_at = timezone.now()
        artifact.save(update_fields=['stage', 'status', 'error_message', 'finished_at'])
        raise e # Re-raise to trigger RQ retry if configured

def _generate_podcast(artifact, context, options, job_id):
    # 1. Generate Script with Dynamic Host Persona
    bot = artifact.chat.bot

    # Determine language preference
    language = options.get('language')
    if not language and hasattr(artifact.chat, 'language'):
        language = artifact.chat.language
    if not language and hasattr(bot, 'language'):
        language = bot.language

    t_script = now_ms()
    log_perf("artifact.gemini_generate_start", artifact.id, job_id=job_id, type='podcast_script')
    script = PodcastScriptingService.generate_script(
        title=artifact.title,
        context=context,
        duration_constraint=options.get('target_duration', 'Medium'),
        bot_name=bot.name,
        bot_prompt=bot.prompt,
        language=language
    )
    log_perf("artifact.gemini_generate_end", artifact.id, job_id=job_id, type='podcast_script', elapsed_ms=ms_since(t_script))
    artifact.content = script

    # 2. Rendering Audio (Mixing)
    artifact.stage = KnowledgeArtifact.Stage.RENDERING_EXPORT
    artifact.save(update_fields=['stage'])

    t_mix = now_ms()
    log_perf("artifact.mix_audio_start", artifact.id, job_id=job_id)
    audio_path, transcript, total_duration_ms = AudioMixerService.mix_podcast(script, bot_voice_enum=bot.voice)
    log_perf("artifact.mix_audio_end", artifact.id, job_id=job_id, elapsed_ms=ms_since(t_mix))

    artifact.media_url = f"/media/{audio_path}"

    # Calculate readable duration (MM:SS)
    seconds = total_duration_ms / 1000
    minutes = int(seconds // 60)
    rem_seconds = int(seconds % 60)
    artifact.duration = f"{minutes}:{rem_seconds:02d}"

    # 3. Assemble Final Content (Schema V1)
    if isinstance(script, dict):
        # New Flow
        artifact.content = {
            "schema_version": 1,
            "episode_title": script.get("episode_title", artifact.title),
            "episode_summary": script.get("episode_summary", ""),
            "chapters": script.get("chapters", []),
            "dialogue": script.get("dialogue", []),
            "transcript": transcript
        }
    else:
        # Legacy Flow Fallback
        artifact.content = {
            "schema_version": 1,
            "episode_title": artifact.title,
            "episode_summary": "Generated Podcast",
            "chapters": [],
            "dialogue": script if isinstance(script, list) else [],
            "transcript": transcript
        }

def _generate_standard_artifact(artifact, full_context, options, job_id):
    client = get_ai_client()
    # model_name = get_model('chat') # Already updated to use GENAI_MODEL_TEXT
    model_name = GENAI_MODEL_TEXT

    bot_prompt = artifact.chat.bot.prompt if artifact.chat.bot and artifact.chat.bot.prompt else None
    system_instruction, response_schema = _build_artifact_system_instruction(
        artifact.type,
        artifact.title,
        full_context,
        options,
        bot_prompt=bot_prompt
    )

    temperature = 0.3 if options.get('source_ids') else 0.7

    generate_config = types.GenerateContentConfig(
        temperature=temperature,
        system_instruction=system_instruction,
        response_mime_type="application/json"
    )

    if response_schema:
        generate_config.response_schema = response_schema

    # Implement Retry Logic for JSON
    max_retries = 2
    last_error = None

    t_gen = now_ms()
    log_perf("artifact.gemini_generate_start", artifact.id, job_id=job_id, model=model_name)

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents="Generate the artifact content based on the system instructions and context.",
                config=generate_config
            )

            log_perf("artifact.gemini_generate_end", artifact.id, job_id=job_id, elapsed_ms=ms_since(t_gen), attempt=attempt+1)

            if response.parsed:
                artifact.content = response.parsed
                return # Success
            else:
                try:
                    artifact.content = json.loads(response.text)
                    return # Success
                except json.JSONDecodeError:
                     if artifact.type == KnowledgeArtifact.ArtifactType.SUMMARY:
                         artifact.content = {"summary": response.text}
                         return # Success (Fallback for summary)
                     else:
                         raise ValueError("Failed to parse JSON response")
        except Exception as e:
            logger.warning(f"[{artifact.correlation_id}] Attempt {attempt+1}/{max_retries} failed: {e}")
            last_error = e
            time.sleep(1) # Wait briefly before retry

    # If loop finishes without return, raise the last error
    if last_error:
        raise last_error
    else:
        raise ValueError("Failed to generate valid artifact content after retries.")


def _build_artifact_system_instruction(artifact_type, title, context, options, bot_prompt=None):
    difficulty = options.get('difficulty', 'Medium')
    quantity = options.get('quantity', 10)
    instructions = options.get('custom_instructions', '')

    # 1. STYLE / PERSONA
    persona_section = ""
    if bot_prompt:
        persona_section = (
            f"YOUR PERSONALITY/ROLE:\n{bot_prompt}\n"
            "Adopt this persona for the tone and style of the explanation."
        )

    # 2. TASK DEFINITION
    task_section = (
        f"You are an expert educational content generator. "
        f"Create a {artifact_type} titled '{title}'.\n"
        f"Language: Detect the language from the context (default to Portuguese if unclear).\n"
        f"Target Audience Difficulty: {difficulty}.\n"
    )
    if instructions:
        task_section += f"CUSTOM INSTRUCTIONS:\n{instructions}\n"

    # Schema Selection
    schema = None
    if artifact_type == KnowledgeArtifact.ArtifactType.QUIZ:
        task_section += f"Generate exactly {quantity} questions."
        schema = QUIZ_SCHEMA
    elif artifact_type == KnowledgeArtifact.ArtifactType.FLASHCARD:
        task_section += f"Generate exactly {quantity} cards."
        schema = FLASHCARD_SCHEMA
    elif artifact_type == KnowledgeArtifact.ArtifactType.SUMMARY:
        task_section += "Generate a comprehensive summary and key points."
        schema = SUMMARY_SCHEMA
    elif artifact_type == KnowledgeArtifact.ArtifactType.SLIDE:
        task_section += f"Generate exactly {quantity} slides."
        schema = SLIDE_SCHEMA

    # 3. FACT POLICY (HARD CONSTRAINTS)
    fact_policy = (
        "FACT POLICY (STRICT RULES):\n"
        "- USE ONLY THE PROVIDED CONTEXT MATERIAL FOR FACTS.\n"
        "- DO NOT INVENT DATA OR HALLUCINATE INFORMATION NOT PRESENT IN THE SOURCE.\n"
        "- IF THE CONTEXT IS INSUFFICIENT, STATE THAT CLEARLY IN THE CONTENT INSTEAD OF INVENTING.\n"
        "- OUTPUT MUST MATCH THE JSON SCHEMA EXACTLY.\n"
    )

    # 4. CONTEXT
    context_section = f"\nCONTEXT MATERIAL (Source Files Only):\n{context}\n"

    # Combine Sections
    full_instruction = f"{persona_section}\n\n{task_section}\n\n{fact_policy}\n\n{context_section}"

    return full_instruction, schema
