from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from .models import GuestSession
import uuid

class LenientJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to allow fallback to GuestAuthentication
    if the JWT is invalid but a Guest ID is present.
    """
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, AuthenticationFailed) as e:
            # If X-Guest-Id is present, suppress the error so GuestAuthentication can run.
            if request.headers.get('X-Guest-Id'):
                return None
            # Otherwise, raise the error as usual (blocked).
            raise e

class GuestAuthentication(BaseAuthentication):
    """
    Custom authentication to handle Guest Mode via X-Guest-Id header.
    Also enforces idempotency via X-Installation-Id if present.
    Does NOT return a User object, but attaches request.guest_session.
    """
    def authenticate(self, request):
        guest_id = request.headers.get('X-Guest-Id')
        device_label = request.headers.get('X-Guest-Device-Label')
        installation_id = request.headers.get('X-Installation-Id')

        # --- IDEMPOTENCY CHECK ---
        # If installation_id is provided, try to find an ACTIVE existing session first.
        # This prevents users from simply clearing app data/changing X-Guest-Id to reset trials.
        if installation_id:
            try:
                inst_uuid = uuid.UUID(installation_id)
                # Find most recent active session for this installation
                existing_session = GuestSession.objects.filter(
                    installation_id=inst_uuid,
                    is_active=True,
                    trial_expires_at__gt=timezone.now()
                ).order_by('-created_at').first()

                if existing_session:
                    existing_session.save() # Touch last_seen
                    request.guest_session = existing_session
                    return (AnonymousUser(), None)
            except ValueError:
                pass # Invalid UUID, ignore installation_id

        # --- FALLBACK / CREATION ---
        if not guest_id:
            return None

        try:
            uuid_obj = uuid.UUID(guest_id)
        except ValueError:
            return None

        # Check if session exists
        try:
            session = GuestSession.objects.get(id=uuid_obj)
            created = False
        except GuestSession.DoesNotExist:
            # --- RATE LIMITING ---
            # If creating a NEW session and we have an installation_id, check for abuse.
            if installation_id:
                try:
                    inst_uuid = uuid.UUID(installation_id)
                    # Count sessions created by this installation in the last hour
                    recent_count = GuestSession.objects.filter(
                        installation_id=inst_uuid,
                        created_at__gt=timezone.now() - timezone.timedelta(hours=1)
                    ).count()

                    if recent_count >= 3:
                        # Soft block or error?
                        # Raising AuthenticationFailed will block the request with 401/403
                        raise AuthenticationFailed("Muitas sessões criadas recentemente. Tente novamente mais tarde.")
                except ValueError:
                    pass

            session = GuestSession(id=uuid_obj)
            created = True

        # Update fields
        if created:
            if device_label:
                session.device_label = device_label

        # Always attempt to bind installation_id if provided
        if installation_id:
            try:
                inst_uuid = uuid.UUID(installation_id)
                if session.installation_id != inst_uuid:
                    session.installation_id = inst_uuid
            except: pass

        # Always touch
        session.save()

        # Attach the session to the request for permission checks
        request.guest_session = session

        # Return AnonymousUser so request.user is not None (DRF standard)
        return (AnonymousUser(), None)
