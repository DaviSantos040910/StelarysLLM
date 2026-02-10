import os
import shutil
import hashlib
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.core.cache import cache
from django.contrib.auth import get_user_model
from chat.models import TTSCache
from chat.services.tts_service import generate_tts_audio, TTS_RATE_LIMIT_KEY_PREFIX

User = get_user_model()
TEST_MEDIA_ROOT = os.path.join(os.path.dirname(__file__), 'test_media_tts')

@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class TTSServiceTest(TestCase):
    def setUp(self):
        if not os.path.exists(TEST_MEDIA_ROOT):
            os.makedirs(TEST_MEDIA_ROOT)
        self.user = User.objects.create(username="testuser", email="test@example.com")
        cache.clear()

    def tearDown(self):
        if os.path.exists(TEST_MEDIA_ROOT):
            shutil.rmtree(TEST_MEDIA_ROOT)
        cache.clear()

    @patch('chat.services.tts_service.get_ai_client')
    def test_generate_audio_creates_cache(self, mock_get_client):
        # Setup Mock AI
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_response = MagicMock()
        mock_part = MagicMock()
        # Provide enough dummy bytes for valid wave write
        mock_part.inline_data.data = b'\x00' * 1024
        mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
        mock_client.models.generate_content.return_value = mock_response

        text = "Hello World"
        voice = "Kore"

        # Ensure temp dir exists for test
        os.makedirs(os.path.join(TEST_MEDIA_ROOT, 'temp_tts'), exist_ok=True)

        # Execute
        result = generate_tts_audio(text, voice_name=voice, user=self.user)

        # Assert Success
        self.assertTrue(result['success'])
        self.assertTrue(os.path.exists(result['file_path']))

        # Assert Cache Created
        text_hash = hashlib.sha256(f"{text}:{voice}".encode('utf-8')).hexdigest()
        self.assertTrue(TTSCache.objects.filter(text_hash=text_hash).exists())

        # Check generated content
        self.assertEqual(mock_client.models.generate_content.call_count, 1)

    @patch('chat.services.tts_service.get_ai_client')
    def test_cache_hit_avoids_generation(self, mock_get_client):
        text = "Cached Text"
        voice = "Kore"
        text_hash = hashlib.sha256(f"{text}:{voice}".encode('utf-8')).hexdigest()

        # Pre-populate cache
        cache_dir = os.path.join(TEST_MEDIA_ROOT, 'tts_cache')
        os.makedirs(cache_dir, exist_ok=True)
        file_path = os.path.join(cache_dir, 'test.wav')
        with open(file_path, 'wb') as f:
            f.write(b'cached audio')

        TTSCache.objects.create(
            text_hash=text_hash,
            text=text,
            voice=voice,
            audio_file='tts_cache/test.wav',
            duration_ms=1000
        )

        # Execute
        result = generate_tts_audio(text, voice_name=voice, user=self.user)

        # Assert
        self.assertTrue(result['success'])
        self.assertEqual(result['duration_ms'], 1000)

        # Ensure AI client was NOT called
        mock_get_client.assert_not_called()

    @patch('chat.services.tts_service.get_ai_client')
    def test_rate_limiting(self, mock_get_client):
        # Mock successful generation to avoid errors during loop
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data.data = b'audio'
        mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
        mock_client.models.generate_content.return_value = mock_response

        # Need to mock wave open to prevent file errors during loop
        with patch('chat.services.tts_service.wave.open'):
             # Fill Rate Limit
             key = f"{TTS_RATE_LIMIT_KEY_PREFIX}{self.user.id}"
             cache.set(key, 50, 3600)

             # Execute Request 51
             result = generate_tts_audio("New Text", voice_name="Kore", user=self.user)

             # Assert Failure
             self.assertFalse(result['success'])
             self.assertIn("Rate limit exceeded", result['error'])
