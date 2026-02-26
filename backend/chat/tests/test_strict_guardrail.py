from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.chat_service import get_ai_response
from chat.models import Chat, Bot
from django.contrib.auth import get_user_model

User = get_user_model()

class StrictGuardrailTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="guardrail_user")
        self.bot = Bot.objects.create(
            name="StrictBot",
            owner=self.user,
            strict_context=True,
            allow_web_search=False,
            prompt="You are a polite librarian."
        )
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_guardrail_triggers_on_missing_citation(self, mock_get_client, mock_get_docs, mock_search):
        """
        Verify that if the model generates a response WITHOUT citations in Strict Mode,
        it is replaced by the refusal message (deterministic).
        """
        # 1. Setup Context with GOOD score to pass EvidenceGate
        mock_search.return_value = ([{'content': 'Some content', 'source': 'Doc.pdf', 'score': 0.1}], [])
        mock_get_docs.return_value = [{'source': 'Doc.pdf'}]

        # 2. Mock Gemini Client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # 3. Define behavior:
        # Call 1: The initial generation (HALLUCINATION - No citations)
        # Fallback: Deterministic refusal (no 2nd call to answering model)
        
        response_hallucination = MagicMock()
        response_hallucination.text = "Paris is the capital of France." # No [1] citation!
        
        mock_client.models.generate_content.return_value = response_hallucination

        # Mock style service to avoid LLM call there too
        with patch('chat.services.chat_service.strict_style_service.rewrite_strict_refusal') as mock_rewrite:
            mock_rewrite.side_effect = lambda text, *args: text

            # Execute
            result = get_ai_response(self.chat.id, "Capital of France?")

            # Verify content matches fallback refusal template
            self.assertIn("StrictBot: I couldn’t find this information", result['content'])

            # Verify generate_content was called ONCE (only for the answer attempt)
            self.assertEqual(mock_client.models.generate_content.call_count, 1)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_guardrail_passes_on_valid_citation(self, mock_get_client, mock_get_docs, mock_search):
        """
        Verify that if the model generates a response WITH citations, it is accepted.
        """
        # Setup Context
        mock_search.return_value = ([{'content': 'Paris info', 'source': 'Doc.pdf', 'source_id': '1'}], [])
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        response_valid = MagicMock()
        response_valid.text = "Paris is the capital [1]." # Valid citation

        mock_client.models.generate_content.return_value = response_valid

        # Execute
        result = get_ai_response(self.chat.id, "Capital?")

        # Verify
        # Should contain original text AND the appended legend
        self.assertIn("Paris is the capital [1].", result['content'])
        # The frontend uses structured sources now, not appended text.
        self.assertTrue(result['sources'])
        self.assertEqual(result['sources'][0]['id'], '1')
        
        # Verify called only once
        self.assertEqual(mock_client.models.generate_content.call_count, 1)
