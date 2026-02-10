from django.test import TestCase
from unittest.mock import patch, MagicMock
from studio.services.audio_mixer import AudioMixerService

class PodcastVoiceMappingTest(TestCase):

    @patch('studio.services.audio_mixer.generate_tts_audio')
    @patch('studio.services.audio_mixer.tempfile.NamedTemporaryFile')
    @patch('studio.services.audio_mixer.AudioSegment')
    def test_mixer_uses_mapped_voice(self, mock_segment, mock_temp, mock_tts):
        # Setup
        mock_tts.return_value = {'success': True}
        mock_temp.return_value.__enter__.return_value.name = "/tmp/test.wav"

        script = [{"speaker": "Host (Tutor)", "text": "Hi"}]

        # Test with 'energetic_youth' -> Should use 'Puck'
        AudioMixerService.mix_podcast(script, bot_voice_enum="energetic_youth")

        # Check call
        # Since mix_podcast uses ThreadPoolExecutor, call order isn't guaranteed but here we have 1 call
        # We need to find the call with voice_name='Puck'

        found_puck = False
        for call in mock_tts.call_args_list:
            if call.kwargs.get('voice_name') == 'Puck':
                found_puck = True
                break

        self.assertTrue(found_puck, "Did not find TTS call with Puck voice for energetic_youth")

    @patch('studio.services.audio_mixer.generate_tts_audio')
    @patch('studio.services.audio_mixer.tempfile.NamedTemporaryFile')
    @patch('studio.services.audio_mixer.AudioSegment')
    def test_mixer_fallback_voice(self, mock_segment, mock_temp, mock_tts):
        mock_tts.return_value = {'success': True}
        mock_temp.return_value.__enter__.return_value.name = "/tmp/test.wav"

        script = [{"speaker": "Host (Tutor)", "text": "Hi"}]

        # Test with invalid -> Should use 'Kore' (Default)
        AudioMixerService.mix_podcast(script, bot_voice_enum="unknown_voice")

        found_kore = False
        for call in mock_tts.call_args_list:
            if call.kwargs.get('voice_name') == 'Kore':
                found_kore = True
                break

        self.assertTrue(found_kore, "Did not find TTS call with Kore voice for fallback")
