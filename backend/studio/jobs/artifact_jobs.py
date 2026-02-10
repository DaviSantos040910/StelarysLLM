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

logger = logging.getLogger(__name__)

@job('default', timeout=360, result_ttl=86400, retry=Retry(max=3))
def generate_artifact_job(artifact_id, options):
    start_time = time.time()
    try:
        artifact = KnowledgeArtifact.objects.get(id=artifact_id)
    except KnowledgeArtifact.DoesNotExist:
        logger.error(f"Artifact {artifact_id} not found.")
        return

    # Update Start State
    artifact.stage = KnowledgeArtifact.Stage.ASSEMBLING_CONTEXT
    artifact.started_at = timezone.now()
    artifact.attempts += 1
    artifact.save(update_fields=['stage', 'started_at', 'attempts'])

    try:
        # 1. ASSEMBLING CONTEXT
        config = {
            'selectedSourceIds': options.get('source_ids', []),
            'includeChatHistory': options.get('includeChatHistory', False)
        }
        full_context = SourceAssemblyService.get_context_from_config(
            artifact.chat.id,
            config,
            query=artifact.title
        )

        # 2. GENERATING CONTENT
        artifact.stage = KnowledgeArtifact.Stage.GENERATING
        artifact.save(update_fields=['stage'])

        if artifact.type == KnowledgeArtifact.ArtifactType.PODCAST:
            _generate_podcast(artifact, full_context, options)
        else:
            _generate_standard_artifact(artifact, full_context, options)

        # 3. READY
        artifact.stage = KnowledgeArtifact.Stage.READY
        artifact.status = KnowledgeArtifact.Status.READY
        artifact.finished_at = timezone.now()
        artifact.save(update_fields=['stage', 'status', 'finished_at', 'media_url', 'duration', 'content'])

        duration = (time.time() - start_time) * 1000
        logger.info(f"[{artifact.correlation_id}] Artifact {artifact_id} generated successfully in {duration:.2f}ms")

    except Exception as e:
        logger.error(f"[{artifact.correlation_id}] Job failed for artifact {artifact_id}: {e}", exc_info=True)
        artifact.stage = KnowledgeArtifact.Stage.ERROR
        artifact.status = KnowledgeArtifact.Status.ERROR
        artifact.error_message = str(e)
        artifact.finished_at = timezone.now()
        artifact.save(update_fields=['stage', 'status', 'error_message', 'finished_at'])
        raise e # Re-raise to trigger RQ retry if configured

def _generate_podcast(artifact, context, options):
    # 1. Generate Script with Dynamic Host Persona
    bot = artifact.chat.bot
    script = PodcastScriptingService.generate_script(
        title=artifact.title,
        context=context,
        duration_constraint=options.get('target_duration', 'Medium'),
        bot_name=bot.name,
        bot_prompt=bot.prompt
    )
    artifact.content = script

    # 2. Rendering Audio (Mixing)
    artifact.stage = KnowledgeArtifact.Stage.RENDERING_EXPORT
    artifact.save(update_fields=['stage'])

    audio_path = AudioMixerService.mix_podcast(script, bot_voice_enum=bot.voice)

    artifact.media_url = f"/media/{audio_path}"
    artifact.duration = options.get('target_duration', '10:00')

def _generate_standard_artifact(artifact, full_context, options):
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

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents="Generate the artifact content based on the system instructions and context.",
                config=generate_config
            )

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
