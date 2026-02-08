from django.test import TestCase
from unittest.mock import patch, MagicMock
from chat.models import Chat, ChatMessage
from django.contrib.auth import get_user_model
from bots.models import Bot
from studio.models import KnowledgeSource
from studio.services.source_assembler import SourceAssemblyService
from chat.services.token_service import TokenService

User = get_user_model()

class SourceAssemblerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.bot = Bot.objects.create(name="TestBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.vector_service.vector_service.search_context')
    def test_get_context_rag_chunks(self, mock_search):
        """Testa se o assembler usa o vector_service para buscar chunks relevantes."""

        # Setup Knowledge Source
        source1 = KnowledgeSource.objects.create(
            user=self.user,
            title="File 1.pdf",
            source_type=KnowledgeSource.SourceType.FILE,
            file="path/to/file1.pdf",
            extracted_text="Full text content here..."
        )

        config = {'selectedSourceIds': [source1.id]}
        query = "Generate a quiz about AI"

        # Mock vector service response (New Dict Format)
        mock_search.return_value = ([
            {
                'content': "Chunk 1 relevant content",
                'source': "File 1.pdf",
                'source_id': str(source1.id),
                'chunk_index': 0,
                'total_chunks': 1
            },
            {
                'content': "Chunk 2 relevant content",
                'source': "File 1.pdf",
                'source_id': str(source1.id),
                'chunk_index': 1,
                'total_chunks': 1
            }
        ], []) # memory contexts

        # Execute
        result = SourceAssemblyService.get_context_from_config(self.chat.id, config, query=query)

        # Verify call arguments
        mock_search.assert_called_once()
        args, kwargs = mock_search.call_args
        self.assertEqual(kwargs['query_text'], query)
        self.assertEqual(kwargs['allowed_source_ids'], [str(source1.id)]) # Updated argument
        self.assertEqual(kwargs['limit'], 20)

        # Verify output contains chunks
        self.assertIn("TRECHOS RELEVANTES", result)
        self.assertIn("Chunk 1 relevant content", result)
        self.assertIn("Chunk 2 relevant content", result)
        self.assertIn("[Source: File 1.pdf]", result)

    @patch('chat.vector_service.vector_service.search_context')
    def test_get_context_with_chat_history(self, mock_search):
        """Testa inclusão do histórico junto com RAG."""

        # Setup Chat History
        ChatMessage.objects.create(chat=self.chat, role='user', content="User says hello")
        ChatMessage.objects.create(chat=self.chat, role='assistant', content="Bot says hi")

        # Setup Source
        source1 = KnowledgeSource.objects.create(
            user=self.user,
            title="File 1.pdf",
            extracted_text="content"
        )

        config = {
            'selectedSourceIds': [source1.id],
            'includeChatHistory': True
        }
        query = "Topic"

        mock_search.return_value = ([
            {
                'content': "Chunk 1",
                'source': "File 1.pdf",
                'source_id': str(source1.id)
            }
        ], [])

        result = SourceAssemblyService.get_context_from_config(self.chat.id, config, query=query)

        # Verify both parts are present
        self.assertIn("Chunk 1", result)
        self.assertIn("--- CHAT HISTORY ---", result)
        self.assertIn("User says hello", result)
        self.assertIn("Bot says hi", result)

    @patch('chat.vector_service.vector_service.search_context')
    def test_get_context_no_relevant_chunks(self, mock_search):
        """Testa comportamento quando a busca vetorial não retorna nada."""

        source1 = KnowledgeSource.objects.create(
            user=self.user,
            title="File 1.pdf",
            extracted_text="content"
        )

        config = {'selectedSourceIds': [source1.id]}
        query = "Irrelevant Topic"

        # Mock empty results
        mock_search.return_value = ([], [])

        result = SourceAssemblyService.get_context_from_config(self.chat.id, config, query=query)

        self.assertIn("[Nenhum trecho relevante encontrado", result)
