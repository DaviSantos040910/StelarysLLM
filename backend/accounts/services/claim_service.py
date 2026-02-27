from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError, PermissionDenied
from datetime import timedelta

from accounts.models import GuestSession
from bots.models import Bot
from chat.models import Chat
from chat.vector_service import vector_service
from studio.models import StudySpace, KnowledgeSource
from explore.models import SearchHistory
from billing.models import TrialUsageCounter

import logging

logger = logging.getLogger(__name__)

def claim_guest_session(user, guest_id):
    """
    Migrates all resources from a GuestSession to a User.
    """
    if not guest_id:
        raise ValidationError("X-Guest-Id header is required.")

    try:
        session = GuestSession.objects.get(id=guest_id)
    except GuestSession.DoesNotExist:
        raise ValidationError("Guest session not found.")

    # Idempotency / Conflict check
    if session.claimed_by:
        if session.claimed_by == user:
            # Already claimed by this user - success (idempotent)
            return {
                "claimed": True,
                "already_claimed": True,
                "migrated_counts": {
                    "bots": 0, "spaces": 0, "sources": 0, "chats": 0, "history": 0
                }
            }
        else:
            # Claimed by someone else
            raise PermissionDenied("Guest session already claimed by another user.")

    counts = {}

    with transaction.atomic():
        # 1. Bots
        # Note: Bot.owner is the field name for User FK
        bots_qs = Bot.objects.filter(guest_session=session)
        counts['bots'] = bots_qs.count()
        bots_qs.update(owner=user, guest_session=None)

        # 2. Chats
        # Note: Chat.user is the field name
        chats_qs = Chat.objects.filter(guest_session=session)
        counts['chats'] = chats_qs.count()
        chats_qs.update(user=user, guest_session=None)

        # 3. Study Spaces
        spaces_qs = StudySpace.objects.filter(guest_session=session)
        counts['spaces'] = spaces_qs.count()
        spaces_qs.update(user=user, guest_session=None)

        # 4. Knowledge Sources
        sources_qs = KnowledgeSource.objects.filter(guest_session=session)
        counts['sources'] = sources_qs.count()
        sources_qs.update(user=user, guest_session=None)

        # 5. Search History
        # SearchHistory has a unique constraint (user, term).
        # Direct update might fail if the user already has searched for the same term.
        # We need to handle potential conflicts: ignore duplicates or merge?
        # Simplest: Try update, if integrity error, handle it?
        # Bulk update is hard with unique constraints conflicts.
        # Strategy: Iterate and update_or_create or ignore.
        # Given "SearchHistory" is low criticality, we can iterate.

        history_qs = SearchHistory.objects.filter(guest_session=session)
        history_count = 0
        for item in history_qs:
            # Check if user already has this term
            if not SearchHistory.objects.filter(user=user, term=item.term).exists():
                item.user = user
                item.guest_session = None
                item.save()
                history_count += 1
            else:
                # User already has this term, just delete the guest one or leave it orphaned?
                # Ideally delete it so it's not sticking around.
                item.delete()

        counts['history'] = history_count

        # 6. Migrate Trial Usage Counter
        guest_usage = TrialUsageCounter.objects.filter(guest_session=session).first()
        user_usage = TrialUsageCounter.objects.filter(user=user).first()

        if guest_usage:
            if not user_usage:
                # Simple migration
                guest_usage.user = user
                guest_usage.guest_session = None
                guest_usage.save(update_fields=["user", "guest_session"])
                counts['trial_usage'] = 'migrated'
            else:
                # Merge logic
                user_usage.messages_count += guest_usage.messages_count
                user_usage.source_count += guest_usage.source_count
                user_usage.tutor_count += guest_usage.tutor_count
                user_usage.space_count += guest_usage.space_count
                user_usage.bot_tutor_count += guest_usage.bot_tutor_count
                user_usage.study_space_count += guest_usage.study_space_count
                user_usage.memory_run_used = user_usage.memory_run_used or guest_usage.memory_run_used
                user_usage.memory_used = user_usage.memory_used or guest_usage.memory_used
                user_usage.tts_seconds_count += guest_usage.tts_seconds_count

                # Merge artifacts breakdown (JSON field)
                user_artifacts = user_usage.artifacts_usage or {}
                guest_artifacts = guest_usage.artifacts_usage or {}

                for key, val in guest_artifacts.items():
                    user_artifacts[key] = user_artifacts.get(key, 0) + val

                user_usage.artifacts_usage = user_artifacts
                user_usage.save()

                # Delete guest counter
                guest_usage.delete()
                counts['trial_usage'] = 'merged'

        # 7. Migrate Trial Time
        # Ensure user doesn't get "extra" time by claiming a guest session
        if session.trial_expires_at:
            if user.trial_ends_at:
                # User already has a trial end date, take the stricter one (earlier date)
                if session.trial_expires_at < user.trial_ends_at:
                    user.trial_ends_at = session.trial_expires_at
                    # We don't strictly need to adjust started_at if we trust ends_at,
                    # but keeping it consistent is good practice if derived elsewhere.
            else:
                # User has no trial data yet, inherit from guest
                user.trial_ends_at = session.trial_expires_at
                # Back-calculate start time assuming standard duration (or just copy gap)
                # But strictly we just need the end date for enforcement.
                # Let's set started_at to maintain consistency with the expiration.
                # Assuming standard 3-day trial if we can't infer start.
                # Better: just set ends_at.
                # However, if user.trial_started_at is mandatory/used for "Days Left" display:
                if not user.trial_started_at:
                    user.trial_started_at = timezone.now() # Fallback, or calculate?

            user.save(update_fields=['trial_ends_at', 'trial_started_at'])

        # 8. Mark Session
        session.claimed_by = user
        session.claimed_at = timezone.now()
        session.is_active = False
        session.save()

    # 7. Migrate Vector Embeddings (Non-transactional but safe to run after)
    try:
        migrated_vectors = vector_service.migrate_owner(str(session.id), str(user.id))
        counts['vectors'] = migrated_vectors
    except Exception as e:
        logger.error(f"Failed to migrate vectors for guest {guest_id}: {e}")
        counts['vectors'] = -1

    logger.info(f"User {user.id} claimed guest session {guest_id}. Stats: {counts}")

    return {
        "claimed": True,
        "migrated_counts": counts
    }
