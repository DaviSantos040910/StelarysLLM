from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, GuestSession
from billing.models import Plan, Subscription, UsageCounter, TrialUsageCounter
from billing.services.quotas import check_and_consume, QuotaExceededException
from billing.services.entitlements import get_current_plan, PLAN_TRIAL, PLAN_BASIC, PLAN_FREE_LOCKED
from billing.services.trial_service import start_trial_if_not_started

class BillingServiceTest(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='testuser', email='test@example.com')
        self.guest = GuestSession.objects.create()
        self.basic_plan = Plan.objects.create(code='basic', name='Basic', limits={'messages_monthly': 2000})

    def test_trial_flow_user(self):
        # 1. Start Trial implicitly via check_and_consume
        check_and_consume(user=self.user, resource='messages', quantity=1)

        # Verify Trial started
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.trial_started_at)
        self.assertEqual(get_current_plan(self.user), PLAN_TRIAL)

        # Verify Usage
        usage = TrialUsageCounter.objects.get(user=self.user)
        self.assertEqual(usage.messages_count, 1)

        # Consume up to limit (90)
        # Already used 1. Add 89.
        check_and_consume(user=self.user, resource='messages', quantity=89)
        usage.refresh_from_db()
        self.assertEqual(usage.messages_count, 90)

        # Next one should fail
        with self.assertRaises(QuotaExceededException):
            check_and_consume(user=self.user, resource='messages', quantity=1)

    def test_basic_plan_flow(self):
        # Grant Basic Plan
        Subscription.objects.create(
            user=self.user,
            plan=self.basic_plan,
            status=Subscription.Status.ACTIVE,
            current_period_end=timezone.now() + timedelta(days=30)
        )

        self.assertEqual(get_current_plan(self.user), PLAN_BASIC)

        # Check Message Quota (Monthly)
        check_and_consume(user=self.user, resource='messages', quantity=100)
        usage = UsageCounter.objects.get(user=self.user)
        self.assertEqual(usage.messages_count, 100)

        # Check Source Quota (Total)
        # 50 total allowed. Currently 0 sources.
        # Logic checks db count.
        check_and_consume(user=self.user, resource='source', quantity=1)
        # Logic passes if count < 50. It doesn't increment a counter for sources, just checks DB.

    def test_trial_expiration(self):
        # Start trial
        start_trial_if_not_started(user=self.user)

        # Fast forward time
        self.user.trial_ends_at = timezone.now() - timedelta(hours=1)
        self.user.save()

        self.assertEqual(get_current_plan(self.user), PLAN_FREE_LOCKED)

        with self.assertRaises(QuotaExceededException):
            check_and_consume(user=self.user, resource='messages', quantity=1)

    def test_artifact_limits_trial(self):
        start_trial_if_not_started(user=self.user)

        # Podcast 1
        check_and_consume(user=self.user, resource='artifact', quantity=1, type='podcast')

        # Podcast 2 should fail
        with self.assertRaises(QuotaExceededException):
            check_and_consume(user=self.user, resource='artifact', quantity=1, type='podcast')

        # Quiz 1 should succeed
        check_and_consume(user=self.user, resource='artifact', quantity=1, type='quiz')
