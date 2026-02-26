import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import GuestSession, User
from bots.models import Bot

class GuestToUserFlowTests(TestCase):
    def setUp(self):
        self.guest_id = str(uuid.uuid4())
        self.user_credentials = {"username": "flow_user", "password": "securePass123", "email": "flow@example.com"}
        self.user = User.objects.create_user(**self.user_credentials)
        self.user.is_email_verified = True # Skip verification for this flow
        self.user.save()

        self.client_guest = APIClient()
        self.client_guest.credentials(HTTP_X_GUEST_ID=self.guest_id)

        self.client_user = APIClient() # No auth initially

    def test_full_guest_migration_flow(self):
        # 1. Guest creates a Bot
        # -----------------------
        bot_data = {
            "name": "Flow Bot",
            "prompt": "Testing flow",
            "voice": "energetic_youth",
            "publicity": "Guests"
        }
        res_create = self.client_guest.post('/api/v1/bots/', bot_data)
        self.assertEqual(res_create.status_code, 201)
        bot_id = res_create.data['id']

        # Verify it belongs to guest
        bot = Bot.objects.get(id=bot_id)
        self.assertEqual(str(bot.guest_session.id), self.guest_id)
        self.assertIsNone(bot.owner)

        # 2. User Logs In
        # ---------------
        login_data = {
            "identifier": self.user_credentials["username"],
            "password": self.user_credentials["password"]
        }
        res_login = self.client_user.post('/api/v1/accounts/login/', login_data)
        self.assertEqual(res_login.status_code, 200)
        token = res_login.data['token']

        # 3. Frontend calls Claim Guest
        # -----------------------------
        self.client_user.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res_claim = self.client_user.post(
            '/api/v1/accounts/claim_guest/',
            headers={'X-Guest-Id': self.guest_id}
        )

        self.assertEqual(res_claim.status_code, 200)
        self.assertTrue(res_claim.data['claimed'])
        self.assertEqual(res_claim.data['migrated_counts']['bots'], 1)

        # 4. Verify Final State
        # ---------------------
        bot.refresh_from_db()
        self.assertEqual(bot.owner, self.user)
        self.assertIsNone(bot.guest_session)

        session = GuestSession.objects.get(id=self.guest_id)
        self.assertFalse(session.is_active)
