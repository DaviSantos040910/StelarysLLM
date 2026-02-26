from django.test import TestCase
from unittest.mock import patch, MagicMock
from chat.models import Chat, ChatMessage
from bots.models import Bot
from django.contrib.auth import get_user_model
from chat.services.chat_service import get_ai_response

User = get_user_model()

class BotUpdateReflectionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testreflection")
        self.bot = Bot.objects.create(name="DynamicBot", prompt="Prompt A", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_immediate_personality_update(self, mock_get_client, mock_get_docs, mock_search):
        """
        Verify that updating the bot prompt is immediately reflected in the next chat message.
        """
        # 1. Setup Mock for first interaction (Prompt A)
        mock_search.return_value = ([], [])
        mock_get_docs.return_value = []
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # We don't need to actually call get_ai_response here because we know it fetches from DB.
        # But let's simulate the update flow.

        # 2. Update Bot Prompt to "Prompt B" (Simulating API call from frontend)
        self.bot.prompt = "Prompt B"
        self.bot.save()
        
        # 3. User sends a message
        # The service calls: chat = Chat.objects.get(id=...).bot
        # Since we updated self.bot and saved it to DB, the service should fetch the new version.
        
        # Execute
        get_ai_response(self.chat.id, "Hello")
        
        # Verify
        call_args = mock_client.models.generate_content.call_args
        contents = call_args[1]['contents'] # System instruction is usually in config or prepended to contents if using gemini-1.5 logic?
        # In our implementation `build_system_instruction` puts it into `config.system_instruction`.
        config = call_args[1]['config']
        
        self.assertIn("Prompt B", config.system_instruction)
        self.assertNotIn("Prompt A", config.system_instruction)

