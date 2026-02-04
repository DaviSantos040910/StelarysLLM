# chat/tests/test_ingestion.py
from django.test import SimpleTestCase
from unittest.mock import patch, MagicMock, mock_open
import os

from chat.services.content_extractor import ContentExtractor
from chat.file_processor import FileProcessor
from chat.services.transcription_service import transcribe_youtube_video

class TestIngestion(SimpleTestCase):

    # --- Testes do ContentExtractor (Trafilatura) ---

    @patch('chat.services.content_extractor.trafilatura')
    def test_extract_from_webpage_trafilatura_success(self, mock_trafilatura):
        """Testa se o Trafilatura é chamado e retorna texto com sucesso."""
        mock_trafilatura.fetch_url.return_value = "<html>Content</html>"
        mock_trafilatura.extract.return_value = "Trafilatura Content"

        url = "http://example.com"
        result = ContentExtractor.extract_from_webpage(url)

        self.assertEqual(result, "Trafilatura Content")
        mock_trafilatura.fetch_url.assert_called_with(url)
        mock_trafilatura.extract.assert_called()

    @patch('chat.services.content_extractor.requests.get')
    @patch('chat.services.content_extractor.trafilatura')
    def test_extract_from_webpage_trafilatura_fallback(self, mock_trafilatura, mock_requests):
        """Testa o fallback para BeautifulSoup quando o Trafilatura falha."""
        # Simula falha no Trafilatura
        mock_trafilatura.fetch_url.return_value = None

        # Simula sucesso no BeautifulSoup
        mock_response = MagicMock()
        mock_response.content = b"<html><body><p>BS4 Content</p></body></html>"
        mock_requests.return_value = mock_response

        url = "http://example.com"
        result = ContentExtractor.extract_from_webpage(url)

        self.assertIn("BS4 Content", result)
        mock_trafilatura.fetch_url.assert_called()
        mock_requests.assert_called()

    # --- Testes do FileProcessor (PyMuPDF4LLM) ---

    @patch('chat.file_processor.os.path.exists')
    @patch('chat.file_processor.pymupdf4llm')
    def test_extract_text_pdf_pymupdf(self, mock_pymupdf, mock_exists):
        """Testa se pymupdf4llm é usado para arquivos PDF."""
        mock_exists.return_value = True
        mock_pymupdf.to_markdown.return_value = "| Table | Row |\n|---|---|\n| 1 | 2 |"

        file_path = "test.pdf"
        result = FileProcessor.extract_text(file_path)

        self.assertEqual(result, "| Table | Row |\n|---|---|\n| 1 | 2 |")
        mock_pymupdf.to_markdown.assert_called_with(file_path)

    @patch('chat.file_processor.os.path.exists')
    @patch('chat.file_processor.pymupdf4llm')
    @patch('chat.file_processor.pypdf')
    def test_extract_text_pdf_fallback(self, mock_pypdf, mock_pymupdf, mock_exists):
        """Testa o fallback para pypdf se pymupdf4llm falhar."""
        mock_exists.return_value = True

        # Simula erro no PyMuPDF4LLM
        mock_pymupdf.to_markdown.side_effect = Exception("PyMuPDF Error")

        # Simula sucesso no pypdf
        mock_reader = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PyPDF Content"
        mock_reader.pages = [mock_page]
        mock_pypdf.PdfReader.return_value = mock_reader

        file_path = "test.pdf"
        result = FileProcessor.extract_text(file_path)

        # O retorno é limpo/flattened no fallback
        self.assertEqual(result, "PyPDF Content")
        mock_pypdf.PdfReader.assert_called_with(file_path)

    # --- Testes do YouTube (Fallback para Audio) ---

    @patch('chat.services.content_extractor.YouTubeTranscriptApi')
    @patch('chat.services.transcription_service.transcribe_youtube_video')
    def test_extract_from_youtube_fallback_trigger(self, mock_transcribe_video, mock_yt_api):
        """Testa se o fallback para transcribe_youtube_video é acionado quando a API de transcrição falha."""
        # Simula falha na API oficial
        mock_yt_api.list_transcripts.side_effect = Exception("No transcripts")

        mock_transcribe_video.return_value = {'success': True, 'transcription': 'Audio Transcription'}

        url = "https://www.youtube.com/watch?v=12345"
        result = ContentExtractor.extract_from_youtube(url)

        self.assertEqual(result, "Audio Transcription")
        # Como o import é local e mockamos no source, verificamos se o mock foi chamado
        mock_transcribe_video.assert_called_with(url)

    @patch('chat.services.transcription_service.yt_dlp.YoutubeDL')
    @patch('chat.services.transcription_service.transcribe_audio_gemini')
    @patch('chat.services.transcription_service.tempfile.mkdtemp')
    @patch('chat.services.transcription_service.glob.glob')
    @patch('chat.services.transcription_service.shutil.rmtree')
    def test_transcribe_youtube_video_flow(self, mock_rmtree, mock_glob, mock_mkdtemp, mock_transcribe_gemini, mock_ydl):
        """Testa o fluxo completo de download e transcrição do YouTube."""
        mock_mkdtemp.return_value = "/tmp/test"
        mock_glob.return_value = ["/tmp/test/video.m4a"]
        mock_transcribe_gemini.return_value = {'success': True, 'transcription': 'Gemini Text'}

        # Mock do context manager do YoutubeDL
        mock_ydl_instance = MagicMock()
        mock_ydl.return_value.__enter__.return_value = mock_ydl_instance

        # Mock open para leitura do arquivo de audio
        with patch('chat.services.transcription_service.open', mock_open(read_data=b'audio data')):
            result = transcribe_youtube_video("http://youtube.com/video")

        self.assertEqual(result['transcription'], 'Gemini Text')
        mock_ydl_instance.download.assert_called()
        mock_transcribe_gemini.assert_called()
        mock_rmtree.assert_called_with("/tmp/test", ignore_errors=True)
