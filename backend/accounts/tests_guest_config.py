import uuid
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from accounts.models import GuestSession

class GuestConfigTests(TestCase):
    @override_settings(GUEST_TRIAL_MINUTES=5)
    def test_guest_session_short_trial(self):
        """
        Verify that trial expiration respects the GUEST_TRIAL_MINUTES setting (e.g., 5 minutes).
        """
        session = GuestSession.objects.create()

        # Check if expiration is roughly 5 minutes from now
        now = timezone.now()
        expected_expiry = now + timedelta(minutes=5)

        # Allow small delta for execution time
        delta = abs((session.trial_expires_at - expected_expiry).total_seconds())
        self.assertLess(delta, 10, "Trial expiration should be close to 5 minutes from now")

    @override_settings(GUEST_TRIAL_MINUTES=1440) # 1 day
    def test_guest_session_custom_trial(self):
        session = GuestSession.objects.create()
        now = timezone.now()
        expected_expiry = now + timedelta(minutes=1440)
        delta = abs((session.trial_expires_at - expected_expiry).total_seconds())
        self.assertLess(delta, 10)
