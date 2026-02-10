# chat/services/tts_service.py

import logging
import wave
import hashlib
import os
import shutil
from django.core.cache import cache
from django.conf import settings
from google.genai import types
from django.core.files import File

from .ai_client import get_ai_client
from chat.models import TTSCache
from core.genai_models import GENAI_MODEL_TTS

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
    try:
        # 1. Generate Hash
        text_hash = hashlib.sha256(f"{message_text}:{voice_name}".encode('utf-8')).hexdigest()

        # 2. Check Cache
        cached_tts = TTSCache.objects.filter(text_hash=text_hash).first()
        if cached_tts and cached_tts.audio_file:
            logger.info(f"[TTS] Cache hit for hash {text_hash}")
            if output_path:
                try:
                    with cached_tts.audio_file.open('rb') as f:
                        with open(output_path, 'wb') as dest:
                            shutil.copyfileobj(f, dest)
                    return {'success': True, 'file_path': output_path, 'duration_ms': cached_tts.duration_ms}
                except FileNotFoundError:
                     logger.warning(f"[TTS] Cache file missing for {text_hash}, regenerating...")
                     cached_tts.delete() # Invalid cache entry
            else:
                 # Return cache path directly if no output_path specified
                 return {'success': True, 'file_path': cached_tts.audio_file.path, 'duration_ms': cached_tts.duration_ms}

        # 3. Check Rate Limit (if user provided)
        if user:
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
        # Temporary file creation
        temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_tts')

        # Ensure directory exists immediately before use
        try:
            os.makedirs(temp_dir, exist_ok=True)
        except Exception:
            pass # Ignore if exists

        temp_filename = f"tts_{text_hash}.wav"
        temp_path = os.path.join(temp_dir, temp_filename)

        with wave.open(temp_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(audio_part.data)

        # Calculate duration
        with wave.open(temp_path, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration_ms = int((frames / float(rate)) * 1000)

        # Save to Model
        with open(temp_path, 'rb') as f:
            tts_cache = TTSCache(
                text_hash=text_hash,
                text=message_text,
                voice=voice_name,
                duration_ms=duration_ms
            )
            tts_cache.audio_file.save(temp_filename, File(f), save=True)

        # Cleanup temp
        if os.path.exists(temp_path):
            os.remove(temp_path)

        # 6. Return Result
        final_path = tts_cache.audio_file.path

        # If output_path was requested, copy there
        if output_path and output_path != final_path:
             shutil.copy2(final_path, output_path)
             final_path = output_path

        return {'success': True, 'file_path': final_path, 'duration_ms': duration_ms}

    except Exception as e:
        logger.error(f"[TTS Error] {e}")
        return {'success': False, 'error': str(e)}
