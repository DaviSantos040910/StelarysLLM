from django.test import TestCase
from unittest.mock import patch, MagicMock
from chat.models import Chat, ChatMessage
from django.contrib.auth import get_user_model
from bots.models import Bot
from studio.models import KnowledgeSource
from studio.services.source_assembler import SourceAssemblyService
from chat.services.token_service import TokenService
import json

User = get_user_model()

class SourceAssemblerTest(TestCase):
    def setUp(self):
        # Setup básico de usuário, bot e chat
        self.user = User.objects.create(username="testuser")
        # Bot tem 'owner' em vez de 'user'
        self.bot = Bot.objects.create(name="TestBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.file_processor.FileProcessor.extract_text')
    def test_get_context_caching(self, mock_extract):
        """Testa o cache read-through do SourceAssemblyService (KnowledgeSource)."""

        source1 = KnowledgeSource.objects.create(
            user=self.user,
            title="File 1",
            source_type=KnowledgeSource.SourceType.FILE,
            file="path/to/file1.pdf",
            extracted_text="" # Initially empty
        )

        mock_extract.return_value = "Texto Extraído"

        config = {"selectedSourceIds": [source1.id]}

        # 1. Primeira chamada: Deve extrair e salvar
        result1 = SourceAssemblyService.get_context_from_config(self.chat.id, config)

        self.assertIn("Texto Extraído", result1)
        # Note: We can't strictly assert called_once unless we know extract_text is called.
        # Logic says: if not content and source.file: extract.
        # So it should call it.
        # But we need to ensure SourceAssemblyService calls extract_text.
        # Let's assume it does.

        # Verifica se salvou no banco
        source1.refresh_from_db()
        self.assertEqual(source1.extracted_text, "Texto Extraído")

        # 2. Segunda chamada: Deve usar o cache (não chamar extrator)
        mock_extract.reset_mock()
        result2 = SourceAssemblyService.get_context_from_config(self.chat.id, config)

        self.assertIn("Texto Extraído", result2)
        mock_extract.assert_not_called()

    @patch('chat.file_processor.FileProcessor.extract_text')
    def test_get_context_token_limit(self, mock_extract):
        """Testa se o assembler respeita o limite de tokens."""

        # Define um limite: 200 tokens (800 chars)
        original_limit = SourceAssemblyService.MAX_CONTEXT_TOKENS
        SourceAssemblyService.MAX_CONTEXT_TOKENS = 200

        try:
            # Texto com 300 tokens (1200 chars) -> Deve truncar
            long_text = "a" * 1200
            mock_extract.return_value = long_text

            source1 = KnowledgeSource.objects.create(
                user=self.user,
                title="big.txt",
                source_type=KnowledgeSource.SourceType.FILE,
                file="big.txt"
            )

            config = {"selectedSourceIds": [source1.id]}

            result = SourceAssemblyService.get_context_from_config(self.chat.id, config)

            self.assertIn("--- SOURCE: big.txt (Partial) ---", result)
            self.assertIn("TRUNCATED", result)

            # Should have prefix of roughly 200 tokens * 4 = 800 chars
            self.assertTrue(len(result) >= 800)

        finally:
            SourceAssemblyService.MAX_CONTEXT_TOKENS = original_limit

    @patch('chat.file_processor.FileProcessor.extract_text')
    def test_get_context_files_only(self, mock_extract):
        """Testa a montagem de contexto apenas com arquivos (KnowledgeSource)."""

        source1 = KnowledgeSource.objects.create(
            user=self.user,
            title="file1.pdf",
            source_type=KnowledgeSource.SourceType.FILE,
            file="file1.pdf"
        )
        source2 = KnowledgeSource.objects.create(
            user=self.user,
            title="file2.docx",
            source_type=KnowledgeSource.SourceType.FILE,
            file="file2.docx"
        )

        # Mock do retorno do extrator
        def side_effect(path, mime_type=None):
            if "file1" in path: return "Conteúdo do PDF 1"
            if "file2" in path: return "Conteúdo do DOCX 2"
            return ""
        mock_extract.side_effect = side_effect

        config = {
            "selectedSourceIds": [source1.id, source2.id],
            "includeChatHistory": False
        }

        result = SourceAssemblyService.get_context_from_config(self.chat.id, config)

        self.assertIn("--- SOURCE: file1.pdf ---", result)
        self.assertIn("Conteúdo do PDF 1", result)
        self.assertIn("--- SOURCE: file2.docx ---", result)
        self.assertIn("Conteúdo do DOCX 2", result)

    def test_get_context_with_chat_history(self):
        """Testa que histórico de chat É incluído quando solicitado."""

        # Cria mensagens
        ChatMessage.objects.create(chat=self.chat, role='user', content="Olá")
        ChatMessage.objects.create(chat=self.chat, role='model', content="Oi, tudo bem?")

        source1 = KnowledgeSource.objects.create(
            user=self.user,
            title="dummy.txt",
            source_type=KnowledgeSource.SourceType.FILE,
            extracted_text="Texto do Arquivo"
        )

        config = {
            "selectedSourceIds": [source1.id],
            "includeChatHistory": True
        }

        result = SourceAssemblyService.get_context_from_config(self.chat.id, config)

        self.assertIn("--- SOURCE: dummy.txt ---", result)
        self.assertIn("Texto do Arquivo", result)
        self.assertIn("--- CHAT HISTORY ---", result)
        self.assertIn("Olá", result)
        self.assertIn("Oi, tudo bem?", result)
