import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from .models import GuestSession
from bots.models import Bot
from django.utils import timezone
from datetime import timedelta

class GuestModeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.guest_id = str(uuid.uuid4())
        # Header key in test client must be HTTP_X_GUEST_ID for X-Guest-Id
        self.headers = {'HTTP_X_GUEST_ID': self.guest_id}

    def test_guest_session_creation_and_bot_creation(self):
        """
        Verify that a request with X-Guest-Id creates a GuestSession and a Bot.
        """
        url = '/api/v1/bots/'
        data = {
            "name": "Guest Bot",
            "prompt": "You are a helper.",
            "voice": "energetic_youth",
            "publicity": "Guests"
        }

        response = self.client.post(url, data, **self.headers)

        if response.status_code != 201:
            print(f"Response error: {response.data}")

        self.assertEqual(response.status_code, 201)

        # Check session created
        self.assertTrue(GuestSession.objects.filter(id=self.guest_id).exists())

        # Check bot ownership
        bot = Bot.objects.get(id=response.data['id'])
        self.assertIsNone(bot.owner)
        self.assertEqual(str(bot.guest_session.id), self.guest_id)

    def test_guest_access_denied_without_header(self):
        """
        Verify that requests without header (and no token) are denied.
        """
        url = '/api/v1/bots/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 401) # Standard DRF behavior

    def test_guest_expired_session(self):
        """
        Verify that expired guest session gets 403 TRIAL_EXPIRED.
        """
        # Create session manually and expire it
        session = GuestSession.objects.create(id=self.guest_id)
        session.trial_expires_at = timezone.now() - timedelta(minutes=1)
        session.save()

        url = '/api/v1/bots/'
        response = self.client.get(url, **self.headers)

        self.assertEqual(response.status_code, 403)
        # Check error code if available in detail
        # APIException responses usually have { "detail": "...", "code": "..." } or just detail.
        # But I used default_code in APIException.
        # DRF renders exception detail.
        # Let's inspect response data
        # print(response.data)
        # It should be {'detail': ErrorDetail(string='Trial expired', code='TRIAL_EXPIRED')}

        self.assertEqual(response.data['detail'].code, 'TRIAL_EXPIRED')
