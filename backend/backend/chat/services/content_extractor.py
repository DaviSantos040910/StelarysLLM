import logging
import requests
import re
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
import trafilatura
from chat.file_processor import FileProcessor

logger = logging.getLogger(__name__)

class ContentExtractor:
    """
    Service to extract text content from various sources:
    - Files (PDF, DOCX, TXT) via FileProcessor
    - URLs (Web pages) via Trafilatura (fallback to BeautifulSoup)
    - YouTube Videos via YouTubeTranscriptApi (fallback to Gemini transcription)
    """

    @staticmethod
    def extract_from_file(file_path: str, mime_type: str = None) -> str:
        """
        Wrapper around FileProcessor to extract text from local files.
        """
        return FileProcessor.extract_text(file_path, mime_type)

    @staticmethod
    def extract_from_url(url: str) -> str:
        """
        Determines the type of URL and extracts content accordingly.
        """
        if ContentExtractor.is_youtube_url(url):
            return ContentExtractor.extract_from_youtube(url)
        else:
            return ContentExtractor.extract_from_webpage(url)

    @staticmethod
    def is_youtube_url(url: str) -> bool:
        """
        Checks if the URL is a YouTube video.
        """
        parsed = urlparse(url)
        return parsed.netloc in ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']

    @staticmethod
    def extract_from_youtube(url: str) -> str:
        """
        Extracts transcript from a YouTube video.
        """
        try:
            video_id = ContentExtractor._get_youtube_video_id(url)
            if not video_id:
                return "Erro: Não foi possível identificar o ID do vídeo."

            # Tries to get transcript in Portuguese, then English
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            try:
                transcript = transcript_list.find_transcript(['pt', 'pt-BR'])
            except:
                try:
                    transcript = transcript_list.find_transcript(['en'])
                except:
                    # Fallback to whatever is available
                    transcript = transcript_list.find_generated_transcript(['pt', 'en'])

            # Fetch the actual transcript data
            data = transcript.fetch()

            # Combine text
            full_text = " ".join([item['text'] for item in data])
            return full_text

        except Exception as e:
            logger.warning(f"YouTubeTranscriptApi failed for {url}: {e}. Trying fallback with Gemini...")

            # Import here to avoid circular dependencies if any
            from chat.services.transcription_service import transcribe_youtube_video

            result = transcribe_youtube_video(url)
            if result.get('success'):
                return result.get('transcription', '')
            else:
                return f"Erro ao processar vídeo do YouTube (Fallback): {result.get('error')}"

    @staticmethod
    def _get_youtube_video_id(url: str) -> str:
        """
        Parses video ID from various YouTube URL formats.
        """
        parsed = urlparse(url)
        if parsed.netloc == 'youtu.be':
            return parsed.path[1:]
        if parsed.path == '/watch':
            try:
                return parse_qs(parsed.query)['v'][0]
            except KeyError:
                return None
        if parsed.path.startswith('/embed/'):
            return parsed.path.split('/')[2]
        if parsed.path.startswith('/v/'):
            return parsed.path.split('/')[2]
        # Shorts
        if parsed.path.startswith('/shorts/'):
            return parsed.path.split('/')[2]

        return None

    @staticmethod
    def extract_from_webpage(url: str) -> str:
        """
        Extracts main text content from a generic webpage.
        """
        # 1. Try Trafilatura first
        try:
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                text = trafilatura.extract(downloaded, include_comments=False)
                if text:
                    return text
        except Exception as e:
            logger.warning(f"Trafilatura failed for {url}: {e}")

        # 2. Fallback to BeautifulSoup (existing logic)
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Remove unwanted elements
            for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                script.decompose()

            # Get text
            text = soup.get_text(separator=' ')

            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            clean_text = ' '.join(chunk for chunk in chunks if chunk)

            return clean_text

        except Exception as e:
            logger.error(f"Erro ao extrair da Web ({url}): {e}")
            return f"Erro ao acessar site: {str(e)}"
