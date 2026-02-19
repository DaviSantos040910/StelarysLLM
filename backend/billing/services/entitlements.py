from django.utils import timezone
from ..models import Subscription, TrialUsageCounter

PLAN_TRIAL = 'trial'
PLAN_BASIC = 'basic'
PLAN_FREE_LOCKED = 'free_locked'

TRIAL_MESSAGE_LIMIT = 90

def get_current_plan(user=None, guest_session=None):
    """
    Determines the effective plan for the user or guest.
    Priority:
    1. Active Subscription (Basic/Pro) -> 'basic' (User only)
    2. Trial (if valid and not exhausted) -> 'trial'
    3. Expired/Exhausted -> 'free_locked'
    """
    # 1. Check Subscription (User only)
    if user and hasattr(user, 'subscription'):
        sub = user.subscription
        if sub.is_active():
            # Could check sub.plan.code, assuming 'basic' for now
            return sub.plan.code

    # 2. Check Trial Status
    # Resolve the relevant object for trial fields
    subject = user if user else guest_session
    if not subject:
        return PLAN_FREE_LOCKED # Should not happen usually

    # If trial hasn't started, they are technically in "Pre-Trial" which behaves like Trial (ready to consume)
    # But usually we allow them to proceed until logic starts the trial.
    # So we return TRIAL.

    # Check Expiration by Date
    if subject.trial_ends_at and subject.trial_ends_at < timezone.now():
        return PLAN_FREE_LOCKED

    # Check Expiration by Global Limits (Messages)
    # TrialUsageCounter check
    # We need to find the counter.
    usage = None
    if user:
        usage = TrialUsageCounter.objects.filter(user=user).first()
    elif guest_session:
        usage = TrialUsageCounter.objects.filter(guest_session=guest_session).first()

    if usage:
        if usage.messages_count >= TRIAL_MESSAGE_LIMIT:
            return PLAN_FREE_LOCKED

    return PLAN_TRIAL
