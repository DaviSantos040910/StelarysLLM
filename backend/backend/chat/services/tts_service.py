# chat/services/tts_service.py

import logging
import wave
from google.genai import types

from .ai_client import get_ai_client

logger = logging.getLogger(__name__)


def generate_tts_audio(message_text: str, output_path: str, voice_name: str = "Kore") -> dict:
    """
    Gera áudio TTS usando Gemini e calcula a duração do arquivo WAV.
    Agora suporta escolha de voz (e.g., 'Kore', 'Puck', 'Fenrir').
    """
    try:
        client = get_ai_client()

        # Limita texto para TTS
        safe_text = message_text[:2000]

        response = client.models.generate_content(
            model='gemini-2.5-flash-preview-tts',
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

        # Salva como WAV
        with wave.open(output_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(audio_part.data)

        # Calcula duração
        with wave.open(output_path, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration_ms = int((frames / float(rate)) * 1000)

        return {'success': True, 'file_path': output_path, 'duration_ms': duration_ms}

    except Exception as e:
        logger.error(f"[TTS Error] {e}")
        return {'success': False, 'error': str(e)}
