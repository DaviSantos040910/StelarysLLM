# chat/services/transcription_service.py

import mimetypes
import logging
import tempfile
import os
import glob
import shutil
import yt_dlp
from google.genai import types

from .ai_client import get_ai_client

logger = logging.getLogger(__name__)


def transcribe_audio_gemini(audio_file) -> dict:
    """
    Transcreve áudio usando Gemini.
    Lógica idêntica à transcribe_audio_gemini em ai_service.py.
    """
    try:
        client = get_ai_client()

        # Check if audio_file is a path or a file-like object
        if isinstance(audio_file, str):
             # It's a path
             with open(audio_file, 'rb') as f:
                 audio_bytes = f.read()
                 name = audio_file
        else:
             # It's a file-like object
             audio_bytes = audio_file.read()
             name = getattr(audio_file, 'name', 'audio.m4a')

        mime_type, _ = mimetypes.guess_type(name)
        if not mime_type:
            mime_type = 'audio/m4a'

        audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)

        prompt = (
            "Generate a transcript of the speech in Portuguese. "
            "Return only the transcribed text, strictly without timestamps or speaker labels."
        )

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, audio_part],
            config=types.GenerateContentConfig(temperature=0.2)
        )

        if response.text:
            return {'success': True, 'transcription': response.text.strip()}
        else:
            return {'success': False, 'error': 'No transcription returned'}

    except Exception as e:
        logger.error(f"[Transcription Error] {e}")
        return {'success': False, 'error': str(e)}


def transcribe_youtube_video(url: str) -> dict:
    """
    Baixa o áudio de um vídeo do YouTube e o transcreve usando o Gemini.
    """
    temp_dir = tempfile.mkdtemp()
    try:
        # Configuração do yt-dlp para baixar o melhor áudio (preferência m4a para o Gemini)
        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
        }

        logger.info(f"Baixando áudio do YouTube: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Encontra o arquivo baixado
        files = glob.glob(os.path.join(temp_dir, '*'))
        if not files:
             return {'success': False, 'error': 'Download falhou, nenhum arquivo encontrado'}

        audio_path = files[0]
        logger.info(f"Áudio baixado em: {audio_path}. Iniciando transcrição...")

        # Usa a função existente para transcrever
        # Passamos o path ou o objeto arquivo. transcribe_audio_gemini foi ajustada para aceitar ambos ou podemos abrir aqui.
        # Ajustei transcribe_audio_gemini para ser flexível, mas para garantir, vou abrir aqui.
        with open(audio_path, 'rb') as f:
             return transcribe_audio_gemini(f)

    except Exception as e:
        logger.error(f"Erro no fluxo YouTube (Download/Transcribe): {e}")
        return {'success': False, 'error': str(e)}
    finally:
        # Limpeza do diretório temporário
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info("Arquivos temporários limpos.")
        except Exception as e:
            logger.warning(f"Erro ao limpar arquivos temporários: {e}")
