import logging
import tempfile
import os
import shutil
import glob
import yt_dlp
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi
from chat.services.transcription_service import transcribe_audio_gemini

logger = logging.getLogger(__name__)

# Constants
MAX_YOUTUBE_DURATION_SECONDS = 600 # 10 minutes

class YouTubeService:
    @staticmethod
    def get_transcript(url: str) -> str:
        """
        Retrieves transcript for a YouTube video.
        Priority:
        1. Existing Captions (via YouTubeTranscriptApi)
        2. Audio Download + Gemini Transcription (Fallback)

        Enforces limits (10 min max).
        """
        video_id = YouTubeService._get_youtube_video_id(url)
        if not video_id:
            return "Erro: Não foi possível identificar o ID do vídeo."

        # 1. Try Captions (Fast, Cheap)
        try:
            transcript = YouTubeService._fetch_captions(video_id)
            if transcript:
                return transcript
        except Exception as e:
            logger.info(f"[YouTube] Captions not available for {video_id}: {e}")

        # 2. Fallback: Download & Transcribe (Slow, Costly)
        return YouTubeService._download_and_transcribe(url)

    @staticmethod
    def _fetch_captions(video_id: str) -> str:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Try Portuguese, then English, then Auto-generated
        try:
            transcript = transcript_list.find_transcript(['pt', 'pt-BR'])
        except:
            try:
                transcript = transcript_list.find_transcript(['en'])
            except:
                transcript = transcript_list.find_generated_transcript(['pt', 'en'])

        data = transcript.fetch()
        return " ".join([item['text'] for item in data])

    @staticmethod
    def _download_and_transcribe(url: str) -> str:
        temp_dir = tempfile.mkdtemp()
        try:
            # Check Duration first (fast check)
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                duration = info.get('duration', 0)
                if duration > MAX_YOUTUBE_DURATION_SECONDS:
                    raise ValueError(f"Vídeo excede o limite de {MAX_YOUTUBE_DURATION_SECONDS/60} minutos.")

            # Download
            ydl_opts = {
                'format': 'm4a/bestaudio/best',
                'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
                'noplaylist': True,
                'quiet': True,
                # Enforce limit again during download just in case
                'match_filter': yt_dlp.utils.match_filter_func("duration <= 600"),
            }

            logger.info(f"[YouTube] Downloading audio for fallback: {url}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            files = glob.glob(os.path.join(temp_dir, '*'))
            if not files:
                raise Exception("Download falhou.")

            audio_path = files[0]

            # Transcribe
            with open(audio_path, 'rb') as f:
                result = transcribe_audio_gemini(f)

            if result['success']:
                return result['transcription']
            else:
                raise Exception(result.get('error'))

        except Exception as e:
            logger.error(f"[YouTube] Fallback failed: {e}")
            return f"Erro na transcrição: {str(e)}"
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @staticmethod
    def _get_youtube_video_id(url: str) -> str:
        parsed = urlparse(url)
        if parsed.netloc == 'youtu.be':
            return parsed.path[1:]
        if parsed.path == '/watch':
            try:
                return parse_qs(parsed.query)['v'][0]
            except KeyError:
                return None
        if parsed.path.startswith(('/embed/', '/v/', '/shorts/')):
            return parsed.path.split('/')[2]
        return None
