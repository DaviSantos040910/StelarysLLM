from django.test import TestCase
from unittest.mock import MagicMock, patch
from studio.services.source_assembler import SourceAssemblyService
from chat.models import Chat, Bot
from django.contrib.auth import get_user_model

User = get_user_model()

class AssemblerStrictTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="assembler_user")
        self.bot = Bot.objects.create(name="AssemblerBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('studio.services.source_assembler.vector_service.search_context')
    @patch('studio.services.source_assembler.build_conversation_history')
    def test_assembler_ignores_chat_history(self, mock_build_history, mock_search):
        """
        Verify that even if includeChatHistory=True, the assembler returns ONLY source content.
        """
        # Mock Search Result (RAG Sources)
        mock_search.return_value = ([
            {'source': 'Doc1.pdf', 'content': 'RAG Content A'},
            {'source': 'Doc2.pdf', 'content': 'RAG Content B'}
        ], [])

        # Mock History (Should be IGNORED)
        mock_build_history.return_value = (None, ["User: Hi", "Bot: Hello"])

        # Config with history enabled
        config = {
            'selectedSourceIds': [1, 2],
            'includeChatHistory': True
        }

        # Execute
        context = SourceAssemblyService.get_context_from_config(self.chat.id, config, query="Test")

        # Verify
        self.assertIn("RAG Content A", context)
        self.assertIn("RAG Content B", context)

        # KEY ASSERTION: Chat history should NOT be present
        self.assertNotIn("User: Hi", context)
        self.assertNotIn("Bot: Hello", context)
        self.assertNotIn("--- CHAT HISTORY ---", context)

        # Check that build_conversation_history was NOT even called (optimization)
        # OR if it was called, its result was not used.
        # Since we removed the block, it shouldn't be called.
        mock_build_history.assert_not_called()

    @patch('studio.services.source_assembler.vector_service.search_context')
    def test_assembler_rag_formatting(self, mock_search):
        """
        Verify the formatting of source chunks (unified citation format).
        """
        mock_search.return_value = ([
            {'source': 'Manual.pdf', 'content': 'Instructions...', 'source_id': '101'}
        ], [])

        config = {'selectedSourceIds': [101]}
        context = SourceAssemblyService.get_context_from_config(self.chat.id, config, query="Help")

        # Check format: [Source: Title] Content
        self.assertIn("[Source: Manual.pdf]", context)
        self.assertIn("Instructions...", context)
