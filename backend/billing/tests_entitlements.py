from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, GuestSession
from billing.models import Plan, Subscription, UsageCounter, TrialUsageCounter
from billing.services.quotas import check_and_consume, QuotaExceededException
from billing.services.entitlements import get_entitlements, PLAN_TRIAL, PLAN_BASIC, PLAN_FREE_LOCKED
from billing.services.trial_service import start_trial_if_not_started

class EntitlementsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='ent_user', email='e@e.com')
        self.guest = GuestSession.objects.create()
        self.basic_plan = Plan.objects.create(code='basic', name='Basic')

    def test_trial_entitlements_structure(self):
        # Start trial
        check_and_consume(user=self.user, resource='messages', quantity=1)

        data = get_entitlements(user=self.user)

        self.assertEqual(data['plan'], PLAN_TRIAL)
        self.assertTrue(data['is_trial_active'])
        self.assertIn('limits', data)
        self.assertIn('usage', data)
        self.assertIn('flags', data)

        # Check specific trial flags
        self.assertFalse(data['flags']['allow_web_search'])
        self.assertEqual(data['usage']['messages_total'], 1)
        self.assertTrue(data['flags']['can_create_tutor'])

    def test_guest_trial_structure(self):
        # Start trial for guest
        check_and_consume(guest_session=self.guest, resource='messages', quantity=10)

        data = get_entitlements(guest_session=self.guest)

        self.assertEqual(data['plan'], PLAN_TRIAL)
        self.assertEqual(data['usage']['messages_total'], 10)
        # Check memory limit logic
        self.assertTrue(data['flags']['allow_memory']) # Not used yet

        # Use memory
        check_and_consume(guest_session=self.guest, resource='memory_run', quantity=1)
        data = get_entitlements(guest_session=self.guest)
        self.assertFalse(data['flags']['allow_memory'])
        self.assertEqual(data['flags']['memory_runs_remaining'], 0)

    def test_basic_entitlements(self):
        Subscription.objects.create(
            user=self.user, plan=self.basic_plan,
            status=Subscription.Status.ACTIVE,
            current_period_end=timezone.now() + timedelta(days=30)
        )

        data = get_entitlements(user=self.user)
        self.assertEqual(data['plan'], PLAN_BASIC)
        self.assertTrue(data['flags']['allow_web_search'])
        self.assertEqual(data['limits']['context_history_limit'], 8)
        self.assertEqual(data['limits']['auto_summarize_after_messages'], 15)

    def test_locked_state(self):
        start_trial_if_not_started(user=self.user)
        self.user.trial_ends_at = timezone.now() - timedelta(hours=1)
        self.user.save()

        data = get_entitlements(user=self.user)
        self.assertEqual(data['plan'], PLAN_FREE_LOCKED)
        self.assertTrue(data['flags']['is_locked'])
        self.assertFalse(data['flags']['can_create_tutor'])
