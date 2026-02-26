from django.test import TestCase
from django.core.cache import cache
from unittest.mock import patch, MagicMock
from accounts.models import User
from chat.models import TTSCache
from chat.services.tts_service import generate_tts_audio, TTS_RATE_LIMIT_KEY_PREFIX
from billing.api.exceptions import QuotaExceededException
from billing.models import Subscription, Plan
from django.utils import timezone
from datetime import timedelta

class TTSServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="tts_user")
        # Upgrade user to Basic
        basic_plan, _ = Plan.objects.get_or_create(code='basic', defaults={'name': 'Basic'})
        Subscription.objects.create(
            user=self.user, plan=basic_plan, status='active',
            current_period_end=timezone.now() + timedelta(days=30)
        )
        cache.clear()

    @patch('chat.services.tts_service.get_ai_client')
    def test_generate_audio_creates_cache(self, mock_get_client):
        # Mock SDK Structure: response.candidates[0].content.parts[0].inline_data.data
        mock_response = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data.data = b'fake_audio_bytes'

        # Ensure 'parts' is iterable
        mock_content = MagicMock()
        mock_content.parts = [mock_part]

        mock_candidate = MagicMock()
        mock_candidate.content = mock_content

        mock_response.candidates = [mock_candidate]

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        text = "Hello world testing TTS"
        voice = "Kore"

        result = generate_tts_audio(text, voice_name=voice, user=self.user)
        self.assertTrue(result['success'])

        entries = TTSCache.objects.all()
        self.assertEqual(len(entries), 1)

    @patch('chat.services.tts_service.get_ai_client')
    def test_cache_hit(self, mock_get_client):
        # Setup mock for first call
        mock_response = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data.data = b'fake_audio_bytes'
        mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        text = "Cached Text"
        generate_tts_audio(text, user=self.user) # Call 1

        mock_get_client.reset_mock()

        result = generate_tts_audio(text, user=self.user) # Call 2
        self.assertTrue(result['success'])
        mock_get_client.assert_not_called()

    @patch('chat.services.tts_service.get_ai_client')
    def test_rate_limiting(self, mock_get_client):
        cache_key = f"{TTS_RATE_LIMIT_KEY_PREFIX}{self.user.id}"
        cache.set(cache_key, 50, 3600)

        result = generate_tts_audio("New Text", voice_name="Kore", user=self.user)
        self.assertFalse(result['success'])
        self.assertIn("Rate limit exceeded", result['error'])
