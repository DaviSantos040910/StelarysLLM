import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import GuestSession, User
from bots.models import Bot
from studio.models import StudySpace
from chat.models import Chat

class ClaimGuestTests(TestCase):
    def setUp(self):
        self.guest_id = str(uuid.uuid4())
        self.user_credentials = {"username": "user1", "password": "password123", "email": "user1@example.com"}
        self.user = User.objects.create_user(**self.user_credentials)
        self.other_user = User.objects.create_user(username="user2", password="password123", email="user2@example.com")

        self.client_guest = APIClient()
        self.client_guest.credentials(HTTP_X_GUEST_ID=self.guest_id)

        self.client_user = APIClient()
        self.client_user.force_authenticate(user=self.user)

    def test_successful_claim(self):
        # 1. Create resources as Guest
        self.client_guest.post('/api/v1/bots/', {
            "name": "Guest Bot", "prompt": "Hi", "voice": "energetic_youth", "publicity": "Private"
        })
        self.client_guest.post('/api/v1/studio/spaces/', {
            "title": "Guest Space", "description": "Desc"
        })

        # Verify guest ownership
        bot = Bot.objects.get(name="Guest Bot")
        self.assertEqual(str(bot.guest_session.id), self.guest_id)
        self.assertIsNone(bot.owner)

        # 2. Claim
        response = self.client_user.post('/api/v1/accounts/claim_guest/', headers={'X-Guest-Id': self.guest_id})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['claimed'])
        self.assertEqual(response.data['migrated_counts']['bots'], 1)
        self.assertEqual(response.data['migrated_counts']['spaces'], 1)

        # 3. Verify migration
        bot.refresh_from_db()
        self.assertEqual(bot.owner, self.user)
        self.assertIsNone(bot.guest_session)

        # Verify session state
        session = GuestSession.objects.get(id=self.guest_id)
        self.assertFalse(session.is_active)
        self.assertEqual(session.claimed_by, self.user)

    def test_claim_missing_header(self):
        response = self.client_user.post('/api/v1/accounts/claim_guest/')
        self.assertEqual(response.status_code, 400)

    def test_claim_invalid_session(self):
        fake_id = str(uuid.uuid4())
        response = self.client_user.post('/api/v1/accounts/claim_guest/', headers={'X-Guest-Id': fake_id})
        self.assertEqual(response.status_code, 404)

    def test_claim_conflict(self):
        # Setup session
        session = GuestSession.objects.create(id=self.guest_id)

        # User 1 claims it
        self.client_user.post('/api/v1/accounts/claim_guest/', headers={'X-Guest-Id': self.guest_id})

        # User 2 tries to claim it
        client_u2 = APIClient()
        client_u2.force_authenticate(user=self.other_user)
        response = client_u2.post('/api/v1/accounts/claim_guest/', headers={'X-Guest-Id': self.guest_id})

        self.assertEqual(response.status_code, 409)

    def test_claim_idempotency(self):
        # Setup session
        GuestSession.objects.create(id=self.guest_id)

        # First claim
        res1 = self.client_user.post('/api/v1/accounts/claim_guest/', headers={'X-Guest-Id': self.guest_id})
        self.assertEqual(res1.status_code, 200)

        # Second claim (same user)
        res2 = self.client_user.post('/api/v1/accounts/claim_guest/', headers={'X-Guest-Id': self.guest_id})
        self.assertEqual(res2.status_code, 200)
        self.assertTrue(res2.data.get('already_claimed'))
