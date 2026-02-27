import uuid
from datetime import timedelta
from django.test import TestCase, RequestFactory
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from accounts.models import GuestSession
from accounts.authentication import GuestAuthentication

class GuestAuthInstallationTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.auth = GuestAuthentication()
        self.installation_id = "test-install-123"
        self.guest_id = str(uuid.uuid4())

    def test_reuse_session_by_installation_id(self):
        """
        If installation_id exists and has an active session, reuse it,
        ignoring the provided guest_id.
        """
        # Create an existing session linked to this installation
        existing_session = GuestSession.objects.create(
            installation_id=self.installation_id,
            is_active=True
        )

        # Request with same installation_id but DIFFERENT guest_id
        new_guest_id = str(uuid.uuid4())
        request = self.factory.get(
            '/',
            HTTP_X_INSTALLATION_ID=self.installation_id,
            HTTP_X_GUEST_ID=new_guest_id
        )

        user_auth_tuple = self.auth.authenticate(request)

        # Should return a tuple (AnonymousUser, None)
        self.assertIsNotNone(user_auth_tuple)
        self.assertEqual(request.guest_session.id, existing_session.id)
        self.assertNotEqual(str(request.guest_session.id), new_guest_id)

    def test_rate_limit_blocks_spam(self):
        """
        If creating new sessions by installation_id, limit to 3 per hour.
        """
        # Create 3 sessions for this installation in the last hour
        # They must be inactive so they don't trigger the idempotency reuse
        for _ in range(3):
            GuestSession.objects.create(
                installation_id=self.installation_id,
                created_at=timezone.now(),
                is_active=False
            )

        # Attempt to create a 4th session (different guest_id)
        request = self.factory.get(
            '/',
            HTTP_X_INSTALLATION_ID=self.installation_id,
            HTTP_X_GUEST_ID=str(uuid.uuid4())
        )

        with self.assertRaises(AuthenticationFailed) as cm:
            self.auth.authenticate(request)

        self.assertIn("Too many guest sessions", str(cm.exception))

    def test_backwards_compatibility_no_installation_id(self):
        """
        If no X-Installation-Id, behavior remains same (use X-Guest-Id).
        """
        request = self.factory.get(
            '/',
            HTTP_X_GUEST_ID=self.guest_id
        )

        user_auth_tuple = self.auth.authenticate(request)

        self.assertIsNotNone(user_auth_tuple)
        self.assertEqual(str(request.guest_session.id), self.guest_id)
        self.assertIsNone(request.guest_session.installation_id)

    def test_link_installation_id_on_creation(self):
        """
        When creating a new session with installation_id, save it.
        """
        request = self.factory.get(
            '/',
            HTTP_X_INSTALLATION_ID=self.installation_id,
            HTTP_X_GUEST_ID=self.guest_id
        )

        self.auth.authenticate(request)

        session = GuestSession.objects.get(id=self.guest_id)
        self.assertEqual(session.installation_id, self.installation_id)

    def test_backfill_installation_id(self):
        """
        If session exists but has no installation_id, backfill it.
        """
        # Create session without installation_id
        session = GuestSession.objects.create(id=self.guest_id)
        self.assertIsNone(session.installation_id)

        request = self.factory.get(
            '/',
            HTTP_X_INSTALLATION_ID=self.installation_id,
            HTTP_X_GUEST_ID=self.guest_id
        )

        self.auth.authenticate(request)

        session.refresh_from_db()
        self.assertEqual(session.installation_id, self.installation_id)
