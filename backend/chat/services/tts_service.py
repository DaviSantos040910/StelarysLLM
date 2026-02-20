# chat/services/tts_service.py

import logging
import wave
import hashlib
import os
import shutil
import tempfile
from django.core.cache import cache
from django.conf import settings
from google.genai import types
from django.core.files import File

from .ai_client import get_ai_client
from chat.models import TTSCache
from core.genai_models import GENAI_MODEL_TTS
from studio.services.storage_provider import get_storage_provider
from billing.services.quotas import check_and_consume, QuotaExceededException

logger = logging.getLogger(__name__)

# Constants
TTS_RATE_LIMIT_KEY_PREFIX = "tts_rate_limit_"
TTS_RATE_LIMIT_MAX = 50 # Requests per hour
TTS_RATE_LIMIT_TIMEOUT = 3600 # 1 hour

def generate_tts_audio(message_text: str, output_path: str = None, voice_name: str = "Kore", user=None) -> dict:
    """
    Gera áudio TTS usando Gemini com cache e rate limiting.
    Se output_path for fornecido, copia o arquivo do cache para lá.
    Se não, retorna o caminho do cache.
    """
    temp_path = None
    try:
        # 1. Generate Hash
        text_hash = hashlib.sha256(f"{message_text}:{voice_name}".encode('utf-8')).hexdigest()

        # 2. Check Cache
        cached_tts = TTSCache.objects.filter(text_hash=text_hash).first()
        if cached_tts and cached_tts.audio_file:
            logger.info(f"[TTS] Cache hit for hash {text_hash}")
            if output_path:
                try:
                    # Copia do arquivo de cache (que pode estar no GCS) para o destino
                    # Se output_path for local (temp file do AudioMixer), baixamos.
                    # Se output_path for remoto, isso complica, mas geralmente TTS gera local temp ou cache.

                    with cached_tts.audio_file.open('rb') as f:
                        with open(output_path, 'wb') as dest:
                            shutil.copyfileobj(f, dest)
                    return {'success': True, 'file_path': output_path, 'duration_ms': cached_tts.duration_ms}
                except Exception as e:
                     logger.warning(f"[TTS] Error reading cache for {text_hash}: {e}")
                     # Se falhar ao ler, talvez arquivo não exista mais. Regenera.
                     cached_tts.delete()
            else:
                 # Se não pediu output específico, retorna o path/url do cache
                 return {'success': True, 'file_path': cached_tts.audio_file.name, 'duration_ms': cached_tts.duration_ms}

        # 3. Check Rate Limit (if user provided)
        if user:
            # Billing Quota Check (Let QuotaExceededException propagate)
            # Estimate duration (approx 15 chars per second)
            est_seconds = max(1, len(message_text) // 15)
            check_and_consume(user=user, resource='tts_seconds', quantity=est_seconds)

            cache_key = f"{TTS_RATE_LIMIT_KEY_PREFIX}{user.id}"
            current_count = cache.get(cache_key, 0)
            if current_count >= TTS_RATE_LIMIT_MAX:
                logger.warning(f"[TTS] Rate limit exceeded for user {user.id}")
                return {'success': False, 'error': "Rate limit exceeded. Try again later."}

            # Increment count
            if current_count == 0:
                cache.set(cache_key, 1, TTS_RATE_LIMIT_TIMEOUT)
            else:
                cache.incr(cache_key)

        # 4. Generate Audio via AI
        client = get_ai_client()
        safe_text = message_text[:2000]

        logger.info(f"[TTS] Generating new audio for hash {text_hash}")
        response = client.models.generate_content(
            model=GENAI_MODEL_TTS,
            contents=safe_text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                    )
                )
            )
        )

        if not response.candidates or not response.candidates[0].content.parts:
            raise Exception("Nenhum áudio gerado.")

        audio_part = None
        for p in response.candidates[0].content.parts:
            if getattr(p, "inline_data", None):
                audio_part = p.inline_data
                break

        if not audio_part:
            raise Exception("Nenhum dado de áudio encontrado.")

        # 5. Save to Cache
        # Use tempfile module correctly
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            temp_path = tf.name

            with wave.open(tf, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(audio_part.data)

        # Calculate duration
        with wave.open(temp_path, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration_ms = int((frames / float(rate)) * 1000)

        # Save to Model (Uploads to GCS if configured via DEFAULT_FILE_STORAGE)
        temp_filename = f"tts_{text_hash}.wav"
        with open(temp_path, 'rb') as f:
            tts_cache = TTSCache(
                text_hash=text_hash,
                text=message_text,
                voice=voice_name,
                duration_ms=duration_ms
            )
            # This .save() uses the model's FileField storage (default storage)
            tts_cache.audio_file.save(temp_filename, File(f), save=True)

        # 6. Return Result
        # If output_path was requested, copy there (likely a temp file path from AudioMixer)
        if output_path:
             shutil.copy2(temp_path, output_path)
             final_path = output_path
        else:
             final_path = tts_cache.audio_file.name

        return {'success': True, 'file_path': final_path, 'duration_ms': duration_ms}

    except QuotaExceededException:
        raise
    except Exception as e:
        logger.error(f"[TTS Error] {e}")
        return {'success': False, 'error': str(e)}
    finally:
        # Cleanup temp
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except: pass
