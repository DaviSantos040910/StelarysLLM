import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import GuestSession, User
from bots.models import Bot

class BotPublicityTests(TestCase):
    def setUp(self):
        self.guest_id = str(uuid.uuid4())
        self.user = User.objects.create_user(username="testuser", password="password", is_staff=False, email="test@example.com")
        self.admin = User.objects.create_user(username="admin", password="password", is_staff=True, email="admin@example.com")

        self.client_guest = APIClient()
        self.client_guest.credentials(HTTP_X_GUEST_ID=self.guest_id)

        self.client_user = APIClient()
        self.client_user.force_authenticate(user=self.user)

        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

    def test_guest_creates_bot_forced_private(self):
        # Try to create PUBLIC bot
        res = self.client_guest.post('/api/v1/bots/', {
            "name": "Guest Bot", "prompt": "Hi", "publicity": "Public"
        })
        self.assertEqual(res.status_code, 201)
        bot = Bot.objects.get(id=res.data['id'])
        self.assertEqual(bot.publicity, 'Private')

    def test_user_creates_bot_forced_private(self):
        # Try to create PUBLIC bot
        res = self.client_user.post('/api/v1/bots/', {
            "name": "User Bot", "prompt": "Hi", "publicity": "Public"
        })
        self.assertEqual(res.status_code, 201)
        bot = Bot.objects.get(id=res.data['id'])
        self.assertEqual(bot.publicity, 'Private')

    def test_admin_can_create_public_bot(self):
        # Admin creates PUBLIC bot
        res = self.client_admin.post('/api/v1/bots/', {
            "name": "Admin Bot", "prompt": "Hi", "publicity": "Public"
        })
        self.assertEqual(res.status_code, 201)
        bot = Bot.objects.get(id=res.data['id'])
        self.assertEqual(bot.publicity, 'Public')
