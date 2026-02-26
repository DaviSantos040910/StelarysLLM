from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from bots.models import Bot
from accounts.models import GuestSession
import uuid

User = get_user_model()

class BotDetailPermissionsTest(APITestCase):
    def setUp(self):
        # Create Users
        self.user1 = User.objects.create_user(username='user1', email='user1@example.com', password='password123')
        self.user2 = User.objects.create_user(username='user2', email='user2@example.com', password='password123')

        # Create Guests
        self.guest_session1 = GuestSession.objects.create(id=uuid.uuid4())
        self.guest_session2 = GuestSession.objects.create(id=uuid.uuid4())

        # Create Bots
        self.bot_user1 = Bot.objects.create(owner=self.user1, name="Bot User 1", prompt="Prompt 1")
        self.bot_guest1 = Bot.objects.create(guest_session=self.guest_session1, name="Bot Guest 1", prompt="Prompt 2")

        # URLs
        self.url_bot_user1 = reverse('bot-detail', args=[self.bot_user1.id])
        self.url_bot_guest1 = reverse('bot-detail', args=[self.bot_guest1.id])

    def test_user1_access_own_bot(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url_bot_user1)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user2_access_user1_bot(self):
        self.client.force_authenticate(user=self.user2)
        response = self.client.get(self.url_bot_user1)
        # CURRENTLY FAILS (returns 200) -> EXPECT 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_guest1_access_own_bot(self):
        # Guest authentication simulation via header
        self.client.credentials(HTTP_X_GUEST_ID=str(self.guest_session1.id))
        response = self.client.get(self.url_bot_guest1)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_guest2_access_guest1_bot(self):
        self.client.credentials(HTTP_X_GUEST_ID=str(self.guest_session2.id))
        response = self.client.get(self.url_bot_guest1)
        # CURRENTLY FAILS (returns 200) -> EXPECT 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user1_access_guest1_bot(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url_bot_guest1)
        # CURRENTLY FAILS (returns 200) -> EXPECT 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_guest1_access_user1_bot(self):
        self.client.credentials(HTTP_X_GUEST_ID=str(self.guest_session1.id))
        response = self.client.get(self.url_bot_user1)
        # CURRENTLY FAILS (returns 200) -> EXPECT 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
