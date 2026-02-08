from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.chat_service import get_ai_response
from chat.models import Chat, ChatMessage, Bot
from django.contrib.auth import get_user_model

User = get_user_model()

class NotebookLMStyleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testnb")
        self.bot = Bot.objects.create(
            name="StrictBot",
            owner=self.user,
            strict_context=True,
            allow_web_search=False
        )
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_strict_mode_personality_refusal(self, mock_get_client, mock_get_docs, mock_search):
        """
        Test that strict mode refusal uses the bot's personality.
        """
        # Configure Pirate Bot
        self.bot.prompt = "You are a grumpy Pirate Captain. Always say 'Arrgh!'."
        self.bot.save()

        # Setup: No context found
        mock_search.return_value = ([], []) # doc_contexts, memory_contexts
        # Setup: Docs exist in library
        mock_get_docs.return_value = [{'source': 'TreasureMap.pdf'}]

        # Mock Gemini Client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "Arrgh! The documents say nothing about gold."
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        get_ai_response(self.chat.id, "Where is the gold?")

        # Verify
        # Check if refusal template prompt contains the Pirate instruction
        call_args = mock_client.models.generate_content.call_args
        contents = call_args[1]['contents']
        prompt_text = contents[0]['parts'][0]['text']

        # The prompt should contain the bot's personality
        self.assertIn("You are a grumpy Pirate Captain.", prompt_text)
        # And the strict refusal template
        self.assertIn("You MUST output a response following EXACTLY this template", prompt_text)
        self.assertIn("adopting your personality tone in the placeholders", prompt_text)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_strict_mode_no_context_fallback(self, mock_get_client, mock_get_docs, mock_search):
        """
        Verify that when strict_context is True and no docs are found,
        it triggers the fallback refusal prompt.
        """
        # Setup: No context found
        mock_search.return_value = ([], []) # doc_contexts, memory_contexts
        # Setup: Docs exist in library
        mock_get_docs.return_value = [{'source': 'Physics.pdf'}]

        # Mock Gemini Client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "Os documentos fornecidos não contêm informações sobre..."
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        response = get_ai_response(self.chat.id, "Qual a capital da França?")

        # Verify
        # Check if generate_content was called with the refusal template
        call_args = mock_client.models.generate_content.call_args
        contents = call_args[1]['contents']
        prompt_text = contents[0]['parts'][0]['text']

        self.assertIn("You MUST output a response following EXACTLY this template", prompt_text)
        self.assertIn("Os documentos fornecidos não contêm informações sobre Qual a capital da França?", prompt_text)
        self.assertIn("Physics.pdf", prompt_text)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    def test_strict_mode_no_docs_at_all(self, mock_get_docs, mock_search):
        """
        Verify strict mode with zero documents uploaded.
        """
        mock_search.return_value = ([], [])
        mock_get_docs.return_value = [] # No docs at all

        response = get_ai_response(self.chat.id, "Hello")

        self.assertIn("Para responder, preciso que você adicione fontes", response['content'])

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_mixed_mode_no_context_fallback(self, mock_get_client, mock_get_docs, mock_search):
        """
        Verify that when strict_context is False (Mixed), no docs found, but web search is ON,
        it triggers the Two-Block prompt.
        """
        # Change bot config
        self.bot.strict_context = False
        self.bot.allow_web_search = True
        self.bot.save()

        # Setup: No context found
        mock_search.return_value = ([], [])

        # Mock Gemini
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "Nas suas fontes..."
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        response = get_ai_response(self.chat.id, "Cotação do dólar")

        # Verify prompt
        call_args = mock_client.models.generate_content.call_args
        contents = call_args[1]['contents']
        prompt_text = contents[0]['parts'][0]['text']

        self.assertIn("INSTRUCTION: You must answer using general knowledge/web search, but you MUST format it in two distinct blocks.", prompt_text)
        self.assertIn("Fora do contexto dos documentos, de forma geral:", prompt_text)

        # Verify Tool was added
        config = call_args[1]['config']
        self.assertTrue(hasattr(config, 'tools'), "Config missing tools")

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_citations_format(self, mock_get_client, mock_get_docs, mock_search):
        """
        Verify that citations section is appended when docs are found.
        """
        # Setup: Docs found
        docs_found = [{
            'content': 'Quantum physics is weird.',
            'source': 'Quantum.pdf',
            'source_id': '101'
        }]
        mock_search.return_value = (docs_found, [])

        # Mock Gemini
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "According to [1], physics is weird."
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        response = get_ai_response(self.chat.id, "Explain quantum")

        # Verify content has Legend
        self.assertIn("According to [1], physics is weird.", response['content'])
        self.assertIn("Fontes:", response['content'])
        self.assertIn("[1] Quantum.pdf", response['content'])
