from datetime import timedelta
from django.utils import timezone
from ..models import TrialUsageCounter
from accounts.models import GuestSession

TRIAL_DURATION_DAYS = 3

def start_trial_if_not_started(user=None, guest_session=None):
    """
    Starts the trial period if it hasn't started yet.
    """
    now = timezone.now()
    duration = timedelta(days=TRIAL_DURATION_DAYS)

    # 1. User
    if user:
        if not user.trial_started_at:
            user.trial_started_at = now
            user.trial_ends_at = now + duration
            user.save(update_fields=['trial_started_at', 'trial_ends_at'])

            # Ensure counter exists
            TrialUsageCounter.objects.get_or_create(user=user)
            return True
        return False

    # 2. Guest
    if guest_session:
        # Check if we should "start" (or restart) trial based on first use
        # GuestSession usually sets trial_expires_at on creation.
        # But we want "from first use".
        # We can check if `TrialUsageCounter` exists. If not, it's first use.

        usage, created = TrialUsageCounter.objects.get_or_create(guest_session=guest_session)

        if created:
            # Only reset expiry if we just created the usage counter (first action)
            # This effectively "starts" the trial now.
            guest_session.trial_expires_at = now + duration
            guest_session.save(update_fields=['trial_expires_at'])
            return True

        return False

    return False
