from django.test import TestCase
from unittest.mock import patch, MagicMock
from studio.services.podcast_scripting import PodcastScriptingService
from core.genai_models import GENAI_MODEL_TEXT

class PodcastModelUsageTest(TestCase):

    @patch('studio.services.podcast_scripting.get_ai_client')
    def test_podcast_script_uses_lite_model(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.parsed = [{"speaker": "Host", "text": "Hello"}]
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        PodcastScriptingService.generate_script(
            title="Lesson 1",
            context="Content",
            bot_name="Tutor",
            bot_prompt="Be funny."
        )

        # Assert
        call_args = mock_client.models.generate_content.call_args
        self.assertIsNotNone(call_args)

        # Check model argument (it's the first positional arg or kwarg 'model')
        model_used = call_args.kwargs.get('model')
        self.assertEqual(model_used, GENAI_MODEL_TEXT)
        self.assertEqual(model_used, "gemini-2.5-flash-lite")
