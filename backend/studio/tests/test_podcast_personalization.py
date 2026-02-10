from django.test import TestCase
from unittest.mock import patch, MagicMock
from studio.services.podcast_scripting import PodcastScriptingService
from studio.services.audio_mixer import AudioMixerService

class PodcastPersonalizationTest(TestCase):

    @patch('studio.services.podcast_scripting.get_ai_client')
    def test_script_generation_includes_bot_persona(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()

        # Mock structured response
        mock_response.parsed = {
            "episode_title": "Lesson 1",
            "episode_summary": "Summary",
            "chapters": [],
            "dialogue": [{"speaker": "HOST", "display_name": "Host (Tutor)", "text": "Hello"}]
        }
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        script = PodcastScriptingService.generate_script(
            title="Lesson 1",
            context="Content",
            bot_name="Tutor",
            bot_prompt="Be funny."
        )

        # Assertions
        self.assertIsInstance(script, dict)
        self.assertIn('dialogue', script)
        self.assertEqual(script['dialogue'][0]['speaker'], "HOST")

        # Check Prompt Construction
        call_args = mock_client.models.generate_content.call_args

        # Check System Instruction
        config = call_args.kwargs['config']
        system_instruction = config.system_instruction

        self.assertIn('HOST display name MUST be exactly: "Host (Tutor)"', system_instruction)
        self.assertIn("Be funny", system_instruction)
        self.assertIn("FACT POLICY (HARD RULES — MUST FOLLOW)", system_instruction)

        # Check User Prompt (Context)
        user_prompt = call_args.kwargs['contents']
        self.assertIn("TITLE: Lesson 1", user_prompt)
        self.assertIn("SOURCE MATERIAL", user_prompt)

    @patch('studio.services.audio_mixer.generate_tts_audio')
    @patch('studio.services.audio_mixer.tempfile.NamedTemporaryFile')
    def test_audio_mixer_voice_selection(self, mock_temp, mock_tts):
        # Setup Mocks
        mock_tts.return_value = {'success': True}
        mock_temp.return_value.__enter__.return_value.name = "/tmp/test.wav"

        script = [
            {"speaker": "Host (Tutor)", "text": "Hi"},
            {"speaker": "Co-host", "text": "Hello"}
        ]

        # We mock Pydub AudioSegment to avoid real file ops failing
        with patch('studio.services.audio_mixer.AudioSegment'):
            AudioMixerService.mix_podcast(script)

        # Verify Voice Selection
        # Call 1: Host -> Kore
        # Call 2: Co-host -> Fenrir

        # We can inspect calls to generate_tts_audio
        self.assertEqual(mock_tts.call_count, 2)

        # Since calls happen in threads, order isn't guaranteed, so we check existence
        calls = [c.kwargs['voice_name'] for c in mock_tts.call_args_list]
        self.assertIn("Kore", calls)
        self.assertIn("Fenrir", calls)
