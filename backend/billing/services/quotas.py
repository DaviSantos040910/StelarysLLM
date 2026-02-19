from django.utils import timezone
from django.db import transaction
from django.db.models import F
from ..models import UsageCounter, TrialUsageCounter, Plan, Subscription
from django.contrib.auth import get_user_model
from .entitlements import get_current_plan, PLAN_TRIAL, PLAN_BASIC, PLAN_FREE_LOCKED
from .trial_service import start_trial_if_not_started
from ..api.exceptions import QuotaExceededException
from studio.models import KnowledgeSource

User = get_user_model()

# --- QUOTA DEFINITIONS ---
BASIC_LIMITS = {
    'messages': 2000,
    'artifacts': 50,
    'tts_seconds': 10800,
    'sources': 50,
}

TRIAL_LIMITS = {
    'messages': 90,
    'sources': 1,
    'bot_tutor': 1,
    'study_space': 1,
    'memory_run': 1,
    # Artifacts per type 1 handled below
}

def check_and_consume(user=None, guest_session=None, resource=None, quantity=1, **kwargs):
    """
    Consumes quota ATOMICALLY with locks.
    Raises QuotaExceededException (HTTP 422) if failed.
    """

    plan = get_current_plan(user, guest_session)

    if plan == PLAN_FREE_LOCKED:
        raise QuotaExceededException(
            detail="Seu período de teste expirou ou o limite foi atingido. Assine para continuar.",
            code="plan_locked",
            meta={"plan": "locked"}
        )

    if plan == PLAN_TRIAL:
        # Ensure trial started
        start_trial_if_not_started(user, guest_session)
        _check_consume_trial(user, guest_session, resource, quantity, **kwargs)

    elif plan == PLAN_BASIC:
        _check_consume_basic(user, resource, quantity, **kwargs)

    else:
        # Fallback (e.g. Pro or unknown)
        pass

def _check_consume_basic(user, resource, quantity, **kwargs):
    if not user:
        raise QuotaExceededException("Basic plan requires a user account.")

    # Get Dynamic Limits
    plan_limits = {}
    if hasattr(user, 'subscription') and user.subscription.plan:
        plan_limits = user.subscription.plan.limits or {}

    current_period = timezone.now().strftime('%Y-%m')

    # Use transaction to lock the counter row
    with transaction.atomic():
        # --- Race Condition Mitigation ---
        # For 'source', we check TOTAL count which is not in UsageCounter.
        # To prevent race conditions (T1 check, T2 check, T1 create, T2 create),
        # we lock the User record (principal). This serializes checks for this user.
        if resource == 'source':
            try:
                # Locks the user row until transaction ends
                _ = User.objects.select_for_update().get(pk=user.pk)
            except User.DoesNotExist:
                # Should not happen if user is authenticated
                pass

        usage, created = UsageCounter.objects.get_or_create(user=user, period=current_period)

        # Now lock the usage row
        usage = UsageCounter.objects.select_for_update().get(id=usage.id)

        # 1. Artifacts
        if resource == 'artifact':
            limit = plan_limits.get('artifacts_monthly', BASIC_LIMITS['artifacts'])
            if usage.artifacts_count + quantity > limit:
                raise QuotaExceededException(
                    detail=f"Limite mensal de artefatos ({limit}) atingido.",
                    code="basic_artifact_limit",
                    meta={"plan": "basic", "limit": limit, "used": usage.artifacts_count}
                )
            usage.artifacts_count += quantity
            usage.save()
            return

        # 2. Messages
        if resource == 'messages':
            limit = plan_limits.get('messages_monthly', BASIC_LIMITS['messages'])
            if usage.messages_count + quantity > limit:
                raise QuotaExceededException(
                    detail=f"Limite mensal de mensagens ({limit}) atingido.",
                    code="basic_message_limit",
                    meta={"plan": "basic", "limit": limit, "used": usage.messages_count}
                )
            usage.messages_count += quantity
            usage.save()
            return

        # 3. TTS
        if resource == 'tts_seconds':
            limit = plan_limits.get('tts_seconds_monthly', BASIC_LIMITS['tts_seconds'])
            if usage.tts_seconds_count + quantity > limit:
                raise QuotaExceededException(
                    detail=f"Limite mensal de TTS ({limit}s) atingido.",
                    code="basic_tts_limit",
                    meta={"plan": "basic", "limit": limit, "used": usage.tts_seconds_count}
                )
            usage.tts_seconds_count += quantity
            usage.save()
            return

        # 4. Sources (Total - Not in UsageCounter)
        if resource == 'source':
            # Count DB
            # With User locked above, this check is serialized for the user.
            count = KnowledgeSource.objects.filter(user=user).count()
            limit = plan_limits.get('sources_total', BASIC_LIMITS['sources'])
            if count + quantity > limit:
                 raise QuotaExceededException(
                    detail=f"Limite total de fontes ({limit}) atingido.",
                    code="basic_source_limit",
                    meta={"plan": "basic", "limit": limit, "used": count}
                )
            return

def _check_consume_trial(user, guest_session, resource, quantity, **kwargs):
    with transaction.atomic():
        # Get/Create Trial Usage
        usage = None
        if user:
            usage, _ = TrialUsageCounter.objects.get_or_create(user=user)
            usage = TrialUsageCounter.objects.select_for_update().get(id=usage.id)
        elif guest_session:
            usage, _ = TrialUsageCounter.objects.get_or_create(guest_session=guest_session)
            usage = TrialUsageCounter.objects.select_for_update().get(id=usage.id)

        # 1. Messages
        if resource == 'messages':
            limit = TRIAL_LIMITS['messages']
            if usage.messages_count + quantity > limit:
                 raise QuotaExceededException(
                    detail=f"Limite de mensagens do Trial ({limit}) atingido.",
                    code="trial_message_limit",
                    meta={"plan": "trial", "limit": limit, "used": usage.messages_count}
                )
            usage.messages_count += quantity
            usage.save()
            return

        # 2. Artifacts (Per Type)
        if resource == 'artifact':
            a_type = kwargs.get('type')
            if not a_type:
                raise QuotaExceededException("Tipo de artefato não especificado.", code="invalid_request")

            key = str(a_type).lower()
            current = usage.artifacts_usage.get(key, 0)

            if current + quantity > 1:
                raise QuotaExceededException(
                    detail=f"Você já criou 1 artefato do tipo '{key}' no Trial.",
                    code="trial_artifact_limit",
                    meta={"plan": "trial", "artifact_type": key, "limit": 1}
                )

            usage.artifacts_usage[key] = current + quantity
            usage.save()
            return

        # 3. Sources
        if resource == 'source':
            limit = TRIAL_LIMITS['sources']
            if usage.source_count + quantity > limit:
                 raise QuotaExceededException(
                    detail=f"Limite de fontes do Trial ({limit}) atingido.",
                    code="trial_source_limit",
                    meta={"plan": "trial", "limit": limit, "used": usage.source_count}
                )
            usage.source_count += quantity
            usage.save()
            return

        # 4. Tutor
        if resource == 'bot_tutor':
            limit = TRIAL_LIMITS['bot_tutor']
            if usage.tutor_count + quantity > limit:
                raise QuotaExceededException(
                    detail=f"Limite de tutores do Trial ({limit}) atingido.",
                    code="trial_tutor_limit",
                    meta={"plan": "trial", "limit": limit, "used": usage.tutor_count}
                )
            usage.tutor_count += quantity
            usage.save()
            return

        # 5. Study Space
        if resource == 'study_space':
            limit = TRIAL_LIMITS['study_space']
            if usage.space_count + quantity > limit:
                 raise QuotaExceededException(
                    detail=f"Limite de espaços de estudo do Trial ({limit}) atingido.",
                    code="trial_space_limit",
                    meta={"plan": "trial", "limit": limit, "used": usage.space_count}
                )
            usage.space_count += quantity
            usage.save()
            return

        # 6. Memory Run
        if resource == 'memory_run':
            if usage.memory_used:
                 raise QuotaExceededException(
                    detail="Memória já utilizada no Trial.",
                    code="trial_memory_limit",
                    meta={"plan": "trial", "limit": 1}
                )
            usage.memory_used = True
            usage.save()
            return

        # 7. TTS (Blocked in Trial)
        if resource == 'tts_seconds':
             raise QuotaExceededException(
                detail="TTS não disponível no Trial.",
                code="trial_tts_blocked",
                meta={"plan": "trial", "limit": 0}
            )

    return
