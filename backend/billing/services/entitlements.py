from datetime import timedelta
from django.utils import timezone
from ..models import Subscription, TrialUsageCounter, UsageCounter

PLAN_TRIAL = 'trial'
PLAN_BASIC = 'basic'
PLAN_FREE_LOCKED = 'free_locked'

# --- LIMIT DEFINITIONS (Sync with requirements) ---
TRIAL_LIMITS = {
    'messages': 90,
    'artifacts': 1, # Per type
    'sources': 1,
    'bot_tutor': 1,
    'study_space': 1,
    'memory_run': 1,
    'tts_seconds': 0, # OFF
    'web_search': False
}

BASIC_LIMITS = {
    'messages_monthly': 2000,
    'artifacts_monthly': 50,
    'sources_total': 50,
    'tts_seconds_monthly': 10800, # 3h
    'memory_optimized': True,
    'web_search_allowed': True
}

def get_current_plan(user=None, guest_session=None):
    """
    Determines the effective plan.
    """
    # 1. Check Subscription (User only)
    if user and hasattr(user, 'subscription'):
        sub = user.subscription
        if sub.is_active():
            return sub.plan.code # 'basic'

    # 2. Check Trial Status
    subject = user if user else guest_session
    if not subject:
        return PLAN_FREE_LOCKED

    # Check Expiration by Date (if started)
    if getattr(subject, 'trial_ends_at', None) and subject.trial_ends_at and subject.trial_ends_at < timezone.now():
        return PLAN_FREE_LOCKED

    # GuestSession uses trial_expires_at
    if hasattr(subject, 'trial_expires_at') and subject.trial_expires_at and subject.trial_expires_at < timezone.now():
        return PLAN_FREE_LOCKED

    # Usage limits are now handled strictly by QuotaService (check_and_consume).
    # Entitlements only return LOCKED if expired by TIME.

    return PLAN_TRIAL


def get_entitlements(user=None, guest_session=None):
    """
    Returns full entitlement details for the frontend.
    """
    plan = get_current_plan(user, guest_session)
    subject = user if user else guest_session

    # Defaults
    response = {
        "plan": plan,
        "is_trial_active": False,
        "trial_days_left": 0,
        "limits": {},
        "usage": {},
        "flags": {}
    }

    # 1. Trial Metadata
    is_trial = (plan == PLAN_TRIAL)
    response['is_trial_active'] = is_trial

    # Calculate days left
    ends_at = getattr(subject, 'trial_ends_at', None) or getattr(subject, 'trial_expires_at', None)
    if ends_at and ends_at > timezone.now():
        delta = ends_at - timezone.now()
        response['trial_days_left'] = max(0, delta.days)
    else:
        # If trial hasn't started, default to 3 days (display purpose)
        if is_trial and not ends_at:
             response['trial_days_left'] = 3
        else:
             response['trial_days_left'] = 0

    # 2. Limits & Flags based on Plan
    if plan == PLAN_BASIC:
        _populate_basic_entitlements(user, response)
    elif plan == PLAN_TRIAL:
        _populate_trial_entitlements(user, guest_session, response)
    else: # LOCKED
        _populate_locked_entitlements(response)

    return response

def _populate_basic_entitlements(user, response):
    # Limits
    response['limits'] = {
        'messages_monthly': BASIC_LIMITS['messages_monthly'],
        'artifacts_monthly': BASIC_LIMITS['artifacts_monthly'],
        'sources_total': BASIC_LIMITS['sources_total'],
        'tts_seconds_monthly': BASIC_LIMITS['tts_seconds_monthly'],
        'rag_chunk_limit': 6,
        'context_history_limit': 8,
        'auto_summarize_after_messages': 15,
        'bot_tutor': -1, # Unlimited
        'study_space': -1
    }

    # Flags
    response['flags'] = {
        'allow_web_search': True,
        'allow_memory': True,
        'memory_runs_remaining': -1, # Unlimited optimized
        'can_create_tutor': True,
        'can_create_space': True,
        'can_upload_source': True,
        'show_pro': False
    }

    # Usage (Monthly)
    current_period = timezone.now().strftime('%Y-%m')
    usage_obj, _ = UsageCounter.objects.get_or_create(user=user, period=current_period)

    # Sources Total
    from studio.models import KnowledgeSource
    sources_count = KnowledgeSource.objects.filter(user=user).count()

    response['usage'] = {
        'messages_monthly': usage_obj.messages_count,
        'artifacts_monthly': usage_obj.artifacts_count,
        'tts_seconds_monthly': usage_obj.tts_seconds_count,
        'sources_total': sources_count
    }

    # Check Flags based on Usage
    if usage_obj.messages_count >= BASIC_LIMITS['messages_monthly']:
        # Block? Or just warn? Quota checks handle blocking.
        pass
    if sources_count >= BASIC_LIMITS['sources_total']:
        response['flags']['can_upload_source'] = False

def _populate_trial_entitlements(user, guest_session, response):
    # Limits
    response['limits'] = {
        'messages_total': TRIAL_LIMITS['messages'],
        'artifacts_per_type': TRIAL_LIMITS['artifacts'],
        'sources_total': TRIAL_LIMITS['sources'],
        'bot_tutor_total': TRIAL_LIMITS['bot_tutor'],
        'study_space_total': TRIAL_LIMITS['study_space'],
        'memory_run_total': TRIAL_LIMITS['memory_run'],
        'rag_chunk_limit': 6, # Default
        'context_history_limit': 12, # Standard (not optimized)
        'auto_summarize_after_messages': 0 # OFF
    }

    # Usage (Total)
    usage_obj = None
    if user:
        usage_obj, _ = TrialUsageCounter.objects.get_or_create(user=user)
    elif guest_session:
        usage_obj, _ = TrialUsageCounter.objects.get_or_create(guest_session=guest_session)

    # Default usage 0 if object creation failed
    if not usage_obj:
        # Fallback empty
        msgs, arts, srcs, tutor, space, mem_used = 0, {}, 0, 0, 0, False
    else:
        msgs = usage_obj.messages_count
        arts = usage_obj.artifacts_usage
        srcs = usage_obj.source_count
        tutor = usage_obj.tutor_count
        space = usage_obj.space_count
        mem_used = usage_obj.memory_used

    response['usage'] = {
        'messages_total': msgs,
        'artifacts_breakdown': arts,
        'sources_total': srcs,
        'bot_tutor_total': tutor,
        'study_space_total': space,
        'memory_run_used': mem_used
    }

    # Flags
    response['flags'] = {
        'allow_web_search': False,
        'allow_memory': not mem_used,
        'memory_runs_remaining': 1 if not mem_used else 0,
        'can_create_tutor': tutor < TRIAL_LIMITS['bot_tutor'],
        'can_create_space': space < TRIAL_LIMITS['study_space'],
        'can_upload_source': srcs < TRIAL_LIMITS['sources'],
        'show_pro': False
    }

def _populate_locked_entitlements(response):
    response['limits'] = {}
    response['usage'] = {}
    response['flags'] = {
        'allow_web_search': False,
        'allow_memory': False,
        'can_create_tutor': False,
        'can_create_space': False,
        'can_upload_source': False,
        'is_locked': True
    }
