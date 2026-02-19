from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, GuestSession
from billing.models import Plan, Subscription, UsageCounter, TrialUsageCounter
from billing.services.quotas import check_and_consume, QuotaExceededException, TRIAL_LIMITS
from billing.services.entitlements import get_current_plan, PLAN_TRIAL, PLAN_BASIC, PLAN_FREE_LOCKED
from studio.models import KnowledgeSource

class QuotaLockingTest(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='lock_user', email='l@l.com')
        self.guest = GuestSession.objects.create()
        self.basic_plan = Plan.objects.create(code='basic', name='Basic', limits={'messages_monthly': 2000})

    def test_trial_message_locking(self):
        # Start trial
        check_and_consume(user=self.user, resource='messages', quantity=1)

        # Verify strict exception format
        # Consume up to limit
        check_and_consume(user=self.user, resource='messages', quantity=TRIAL_LIMITS['messages'] - 1)

        # Next should fail
        with self.assertRaises(QuotaExceededException) as cm:
            check_and_consume(user=self.user, resource='messages', quantity=1)

        exc = cm.exception
        self.assertEqual(exc.default_code, 'trial_message_limit')
        self.assertEqual(exc.meta['plan'], 'trial')
        self.assertEqual(exc.meta['limit'], TRIAL_LIMITS['messages'])

    def test_trial_artifact_locking(self):
        # Podcast 1
        check_and_consume(user=self.user, resource='artifact', quantity=1, type='podcast')

        # Podcast 2 should fail
        with self.assertRaises(QuotaExceededException) as cm:
            check_and_consume(user=self.user, resource='artifact', quantity=1, type='podcast')

        self.assertEqual(cm.exception.default_code, 'trial_artifact_limit')
        self.assertEqual(cm.exception.meta['artifact_type'], 'podcast')

    def test_trial_tts_blocked(self):
        # Should fail immediately (limit 0)
        with self.assertRaises(QuotaExceededException) as cm:
            check_and_consume(user=self.user, resource='tts_seconds', quantity=10)

        self.assertEqual(cm.exception.default_code, 'trial_tts_blocked')

    def test_basic_source_limit(self):
        # Basic Plan
        Subscription.objects.create(
            user=self.user, plan=self.basic_plan,
            status=Subscription.Status.ACTIVE,
            current_period_end=timezone.now() + timedelta(days=30)
        )

        # Create 50 sources
        for i in range(50):
            KnowledgeSource.objects.create(user=self.user, title=f"Source {i}", source_type="TEXT")

        # Check source consumption (should fail at 51)
        with self.assertRaises(QuotaExceededException) as cm:
            check_and_consume(user=self.user, resource='source', quantity=1)

        self.assertEqual(cm.exception.default_code, 'basic_source_limit')
