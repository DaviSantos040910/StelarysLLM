from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import GuestSession, User
from billing.models import TrialUsageCounter
from accounts.services.claim_service import claim_guest_session

class TestClaimGuestSession(TestCase):

    def setUp(self):
        # Ensure we have a clean state if needed
        pass

    def test_trial_usage_migration_simple(self):
        """Verify usage migrates from guest to user when user has no prior usage."""
        user = User.objects.create(email="test@example.com", username="testuser")
        session = GuestSession.objects.create()

        TrialUsageCounter.objects.create(
            guest_session=session,
            messages_count=10,
            bot_tutor_count=1,
            tutor_count=1
        )

        # Claim
        claim_guest_session(user, str(session.id))

        # Assertions
        # Guest usage counter should be deleted or migrated
        assert not TrialUsageCounter.objects.filter(guest_session=session).exists()

        user_usage = TrialUsageCounter.objects.get(user=user)
        self.assertEqual(user_usage.messages_count, 10)
        self.assertEqual(user_usage.bot_tutor_count, 1)
        self.assertEqual(user_usage.tutor_count, 1)

    def test_trial_usage_merge(self):
        """Verify usage merges when both guest and user have existing usage."""
        user = User.objects.create(email="test2@example.com", username="testuser2")
        session = GuestSession.objects.create()

        # User usage
        TrialUsageCounter.objects.create(
            user=user,
            messages_count=5,
            bot_tutor_count=0,
            artifacts_usage={"podcast": 1}
        )

        # Guest usage
        TrialUsageCounter.objects.create(
            guest_session=session,
            messages_count=15,
            bot_tutor_count=1,
            tutor_count=1,
            artifacts_usage={"summary": 2, "podcast": 1}
        )

        # Claim
        claim_guest_session(user, str(session.id))

        # Assertions
        user_usage = TrialUsageCounter.objects.get(user=user)
        self.assertEqual(user_usage.messages_count, 20) # 5 + 15
        self.assertEqual(user_usage.bot_tutor_count, 1) # 0 + 1
        self.assertEqual(user_usage.tutor_count, 1)

        # Check artifacts merge
        arts = user_usage.artifacts_usage
        self.assertEqual(arts["summary"], 2)
        self.assertEqual(arts["podcast"], 2) # 1 + 1

    def test_trial_time_not_extended(self):
        """Verify trial end time is not extended (takes min)."""
        now = timezone.now()
        user = User.objects.create(
            email="test3@example.com",
            username="testuser3",
            trial_ends_at=now + timedelta(days=10) # User has long trial
        )

        session = GuestSession.objects.create(
            trial_expires_at=now + timedelta(days=3) # Guest has short trial
        )

        # Claim
        claim_guest_session(user, str(session.id))

        user.refresh_from_db()
        # Should take the shorter duration (guest's)
        self.assertEqual(user.trial_ends_at, session.trial_expires_at)

    def test_trial_time_set_if_none(self):
        """Verify trial time is set if user has none."""
        now = timezone.now()
        user = User.objects.create(email="test4@example.com", username="testuser4")

        session = GuestSession.objects.create(
            trial_expires_at=now + timedelta(days=3)
        )

        # Claim
        claim_guest_session(user, str(session.id))

        user.refresh_from_db()
        self.assertEqual(user.trial_ends_at, session.trial_expires_at)

    def test_tutor_limit_preserved_after_claim(self):
        """Verify that tutor_count is preserved after claim when user already has a counter."""
        from billing.services.quotas import check_and_consume
        from billing.api.exceptions import QuotaExceededException
        from billing.constants import TRIAL_TUTOR_LIMIT

        user = User.objects.create(email="user_tutor@example.com", username="user_tutor")
        TrialUsageCounter.objects.create(user=user, tutor_count=0)

        session = GuestSession.objects.create()
        TrialUsageCounter.objects.create(
            guest_session=session,
            tutor_count=1,
            bot_tutor_count=1
        )

        claim_guest_session(user, str(session.id))

        with self.assertRaises(QuotaExceededException) as cm:
            check_and_consume(user=user, resource="bot_tutor")
        
        self.assertEqual(cm.exception.default_code, TRIAL_TUTOR_LIMIT)

    def test_space_limit_preserved_after_claim(self):
        """Verify that space_count is preserved after claim."""
        from billing.services.quotas import check_and_consume
        from billing.api.exceptions import QuotaExceededException
        from billing.constants import TRIAL_SPACE_LIMIT

        user = User.objects.create(email="user_space@example.com", username="user_space")
        TrialUsageCounter.objects.create(user=user, space_count=0)

        session = GuestSession.objects.create()
        TrialUsageCounter.objects.create(
            guest_session=session,
            space_count=1,
            study_space_count=1
        )

        claim_guest_session(user, str(session.id))

        with self.assertRaises(QuotaExceededException) as cm:
            check_and_consume(user=user, resource="study_space")
        
        self.assertEqual(cm.exception.default_code, TRIAL_SPACE_LIMIT)
