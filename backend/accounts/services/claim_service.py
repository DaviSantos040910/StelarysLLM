from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import GuestSession
from bots.models import Bot
from chat.models import Chat
from studio.models import StudySpace, KnowledgeSource
from explore.models import SearchHistory

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

        # 6. Mark Session
        session.claimed_by = user
        session.claimed_at = timezone.now()
        session.is_active = False
        session.save()

    logger.info(f"User {user.id} claimed guest session {guest_id}. Stats: {counts}")

    return {
        "claimed": True,
        "migrated_counts": counts
    }
