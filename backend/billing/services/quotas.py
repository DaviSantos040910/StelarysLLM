from django.utils import timezone
from django.db.models import F
from ..models import UsageCounter, TrialUsageCounter, Plan
from .entitlements import get_current_plan, PLAN_TRIAL, PLAN_BASIC, PLAN_FREE_LOCKED
from .trial_service import start_trial_if_not_started

# --- QUOTA DEFINITIONS ---
# Basic limits (Monthly or Total)
BASIC_LIMITS = {
    'messages': 2000,          # Monthly
    'artifacts': 50,           # Monthly
    'tts_seconds': 10800,      # Monthly (3h = 10800s)
    'sources': 50,             # Total
    # 'memory_run': (Optimized, implicit limit?) No hard cap stated, just optimization.
    # 'bot_tutor': ? (Unlimited or ?) Prompt: "Basic... manter estrutura preparada para PRO".
    # Assuming Basic allows multiple bots/spaces unless specified otherwise.
    # Prompt implies limits are on Monthly usage + Total Sources.
    # I'll assume reasonable defaults or unlimited for now unless specified.
}

# Trial limits (Total)
TRIAL_LIMITS = {
    'messages': 90,
    'bot_tutor': 1,
    'study_space': 1,
    'sources': 1,
    'memory_run': 1,
    # Artifacts are per type (1 each)
}

class QuotaExceededException(Exception):
    pass

def check_and_consume(user=None, guest_session=None, resource=None, quantity=1, **kwargs):
    """
    Checks if the user/guest has enough quota for the given resource.
    If yes, consumes it atomically.
    Raises QuotaExceededException if limit reached.
    """
    plan = get_current_plan(user, guest_session)

    if plan == PLAN_FREE_LOCKED:
        raise QuotaExceededException("Trial expired or limit reached. Please upgrade.")

    if plan == PLAN_BASIC:
        _check_consume_basic(user, resource, quantity, **kwargs)
    elif plan == PLAN_TRIAL:
        # Ensure trial is started on first consumption
        start_trial_if_not_started(user, guest_session)
        _check_consume_trial(user, guest_session, resource, quantity, **kwargs)
    else:
        # Default fallback (e.g. Pro or unknown) - pass through for now or block
        pass

def _check_consume_basic(user, resource, quantity, **kwargs):
    # Basic is User only
    if not user:
        raise QuotaExceededException("Basic plan requires a user account.")

    # Get Dynamic Limits from Plan if available
    plan_limits = {}
    if hasattr(user, 'subscription') and user.subscription.plan:
        plan_limits = user.subscription.plan.limits or {}

    # Monthly Limits (UsageCounter)
    if resource in ['messages', 'artifact', 'tts_seconds']:
        current_period = timezone.now().strftime('%Y-%m')
        usage, created = UsageCounter.objects.get_or_create(user=user, period=current_period)

        # Artifacts
        if resource == 'artifact':
            limit = plan_limits.get('artifacts_monthly', BASIC_LIMITS['artifacts'])
            if usage.artifacts_count + quantity > limit:
                raise QuotaExceededException(f"Monthly artifact limit ({limit}) reached.")
            usage.artifacts_count = F('artifacts_count') + quantity
            usage.save()
            return

        # Messages
        if resource == 'messages':
            limit = plan_limits.get('messages_monthly', BASIC_LIMITS['messages'])
            if usage.messages_count + quantity > limit:
                raise QuotaExceededException(f"Monthly message limit ({limit}) reached.")
            usage.messages_count = F('messages_count') + quantity
            usage.save()
            return

        # TTS
        if resource == 'tts_seconds':
            limit = plan_limits.get('tts_seconds_monthly', BASIC_LIMITS['tts_seconds'])
            if usage.tts_seconds_count + quantity > limit:
                raise QuotaExceededException(f"Monthly TTS limit ({limit}s) reached.")
            usage.tts_seconds_count = F('tts_seconds_count') + quantity
            usage.save()
            return

    # Total Limits (DB Count)
    elif resource == 'source':
        # Check total sources
        from studio.models import KnowledgeSource
        count = KnowledgeSource.objects.filter(user=user).count()
        limit = plan_limits.get('sources_total', BASIC_LIMITS['sources'])
        if count + quantity > limit:
            raise QuotaExceededException(f"Total source limit ({limit}) reached.")
        # No counter to update, object creation happens outside
        return

    # Other resources (Bot, Space) -> Assume unlimited for Basic for now or apply reasonable cap
    # Prompt didn't specify Basic limits for these, implies "unlocked".
    return

def _check_consume_trial(user, guest_session, resource, quantity, **kwargs):
    # Get or Create TrialUsageCounter
    # Note: creation might race, but usually one user one request.
    usage = None
    if user:
        usage, _ = TrialUsageCounter.objects.get_or_create(user=user)
    elif guest_session:
        usage, _ = TrialUsageCounter.objects.get_or_create(guest_session=guest_session)

    if not usage:
        raise QuotaExceededException("Could not initialize trial usage.")

    # 1. Messages
    if resource == 'messages':
        if usage.messages_count + quantity > TRIAL_LIMITS['messages']:
            raise QuotaExceededException(f"Trial message limit ({TRIAL_LIMITS['messages']}) reached.")
        usage.messages_count = F('messages_count') + quantity
        usage.save()
        return

    # 2. Artifacts (Per Type)
    if resource == 'artifact':
        a_type = kwargs.get('type') # e.g. 'podcast', 'summary'
        if not a_type:
             raise QuotaExceededException("Artifact type required for trial check.")

        # Normalize type key
        key = str(a_type).lower()
        current_usage = usage.artifacts_usage.get(key, 0)

        if current_usage + quantity > 1: # Limit 1 per type
             raise QuotaExceededException(f"Trial limit (1) reached for artifact type '{key}'.")

        # Update JSON
        usage.artifacts_usage[key] = current_usage + quantity
        usage.save()
        return

    # 3. Sources
    if resource == 'source':
        if usage.source_count + quantity > TRIAL_LIMITS['sources']:
             raise QuotaExceededException(f"Trial source limit ({TRIAL_LIMITS['sources']}) reached.")
        usage.source_count = F('source_count') + quantity
        usage.save()
        return

    # 4. Bot (Tutor)
    if resource == 'bot_tutor':
        if usage.tutor_count + quantity > TRIAL_LIMITS['bot_tutor']:
             raise QuotaExceededException(f"Trial tutor limit ({TRIAL_LIMITS['bot_tutor']}) reached.")
        usage.tutor_count = F('tutor_count') + quantity
        usage.save()
        return

    # 5. Study Space
    if resource == 'study_space':
        if usage.space_count + quantity > TRIAL_LIMITS['study_space']:
             raise QuotaExceededException(f"Trial space limit ({TRIAL_LIMITS['study_space']}) reached.")
        usage.space_count = F('space_count') + quantity
        usage.save()
        return

    # 6. Memory Run
    if resource == 'memory_run':
        if usage.memory_used:
             raise QuotaExceededException("Trial memory run limit (1) reached.")
        usage.memory_used = True
        usage.save()
        return

    # 7. TTS
    if resource == 'tts_seconds':
        # Trial has NO TTS allowed? Or implied?
        # Prompt: "TTS... BASIC: 3h...". "TRIAL...".
        # Trial limits list doesn't mention TTS explicitly in "Hard limits".
        # But usually features are limited.
        # "Trial limits (hard limits): ... Memoria: 1 vez ... Web search: OFF".
        # It doesn't say TTS is OFF.
        # But typically TTS is expensive.
        # I'll allow reasonable TTS or block it?
        # "TTS... 3h/mês (Basic)".
        # Let's assume Trial allows some TTS or uses message limit?
        # Prompt doesn't explicit forbid TTS for Trial.
        # I will allow it without hard cap other than it consumes "something"?
        # No, better to block or allow small amount.
        # "Artifacts... podcast" produces audio.
        # "Podcast" is allowed 1 time.
        # "TTS" usually refers to chat message read aloud.
        # I'll block TTS for now as it's a premium feature usually, or allow 1 min?
        # To be safe and strict as per "Limitados", I'll block TTS in Trial unless for the Podcast Artifact (which is separate).
        # Actually, let's look at the requirements again.
        # "Basic (R$29,90) ... 3h de TTS/mês".
        # Trial limits list DOES NOT list TTS.
        # Implies TTS might be OFF or unlimited? Unlikely unlimited.
        # Given "Web search: OFF", likely "TTS: OFF" too for Trial.
        raise QuotaExceededException("TTS is not available in Trial.")

    return
