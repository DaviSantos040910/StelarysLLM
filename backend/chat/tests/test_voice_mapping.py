from django.test import SimpleTestCase
from chat.services.voice_mapping import get_gemini_voice

class VoiceMappingTest(SimpleTestCase):
    def test_valid_voices(self):
        self.assertEqual(get_gemini_voice('energetic_youth'), 'Puck')
        self.assertEqual(get_gemini_voice('calm_adult'), 'Kore')
        self.assertEqual(get_gemini_voice('professor'), 'Fenrir')
        self.assertEqual(get_gemini_voice('storyteller'), 'Aoede')

    def test_case_insensitivity(self):
        self.assertEqual(get_gemini_voice('Energetic_Youth'), 'Puck')
        self.assertEqual(get_gemini_voice('PROFESSOR'), 'Fenrir')

    def test_invalid_voice_returns_fallback(self):
        self.assertEqual(get_gemini_voice('invalid_voice'), 'Kore')
        self.assertEqual(get_gemini_voice(''), 'Kore')
        self.assertEqual(get_gemini_voice(None), 'Kore')
