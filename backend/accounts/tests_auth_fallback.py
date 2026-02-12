import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import GuestSession, User

class AuthFallbackTests(TestCase):
    def setUp(self):
        self.guest_id = str(uuid.uuid4())
        # Create session so it's valid
        GuestSession.objects.create(id=self.guest_id)

        self.client = APIClient()
        self.url = '/api/v1/bots/' # A protected endpoint that allows guest

    def test_invalid_token_with_guest_id_succeeds(self):
        """
        If Token is invalid but X-Guest-Id is present, it should fallback to Guest.
        """
        # Set invalid token
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token', HTTP_X_GUEST_ID=self.guest_id)

        # Should NOT return 401
        response = self.client.get(self.url)

        # 200 OK means authorized (as guest)
        self.assertEqual(response.status_code, 200)

    def test_invalid_token_without_guest_id_fails(self):
        """
        If Token is invalid and NO X-Guest-Id, it should fail (401).
        """
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)
