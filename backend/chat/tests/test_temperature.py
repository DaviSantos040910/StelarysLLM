from django.test import TestCase
from unittest.mock import patch, MagicMock
from chat.services.chat_service import get_ai_response
from chat.models import Chat, ChatMessage
from bots.models import Bot
from django.contrib.auth import get_user_model

User = get_user_model()

class TemperatureLogicTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.bot = Bot.objects.create(name="TestBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.services.chat_service.get_ai_client')
    @patch('chat.services.chat_service._get_smart_context')
    def test_temperature_with_rag(self, mock_context, mock_client):
        """Testa se a temperatura baixa quando há contexto documental."""
        # Setup mocks
        doc_chunk = {'content': "Chunk 1", 'source': 'File1.pdf', 'source_id': 'f1'}
        mock_context.return_value = ([doc_chunk], [], ["File1.pdf"]) # doc_contexts is NOT empty
        mock_gen_model = MagicMock()
        mock_client.return_value.models = mock_gen_model
        mock_gen_model.generate_content.return_value.text = "Response"

        # Execute
        get_ai_response(self.chat.id, "Query")

        # Verify
        args, kwargs = mock_gen_model.generate_content.call_args
        config = kwargs['config']
        self.assertEqual(config.temperature, 0.3)

    @patch('chat.services.chat_service.get_ai_client')
    @patch('chat.services.chat_service._get_smart_context')
    def test_temperature_without_rag(self, mock_context, mock_client):
        """Testa se a temperatura é padrão (0.7) sem documentos."""
        # Setup mocks
        mock_context.return_value = ([], [], []) # doc_contexts is EMPTY
        mock_gen_model = MagicMock()
        mock_client.return_value.models = mock_gen_model
        mock_gen_model.generate_content.return_value.text = "Response"

        # Execute
        get_ai_response(self.chat.id, "Query")

        # Verify
        args, kwargs = mock_gen_model.generate_content.call_args
        config = kwargs['config']
        self.assertEqual(config.temperature, 0.7)
