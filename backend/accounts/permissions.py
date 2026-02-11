from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied, APIException
from django.utils import timezone

class TrialExpired(APIException):
    status_code = 402
    default_detail = 'Trial expired'
    default_code = 'TRIAL_EXPIRED'

class IsUserOrGuest(permissions.BasePermission):
    """
    Allows access to authenticated users OR valid guest sessions.
    """
    def has_permission(self, request, view):
        # 1. User Authenticated
        if request.user and request.user.is_authenticated:
            return True

        # 2. Guest Session Check
        if hasattr(request, 'guest_session') and request.guest_session:
            session = request.guest_session

            if not session.is_active:
                return False

            if session.trial_expires_at and session.trial_expires_at < timezone.now():
                raise TrialExpired()

            return True

        return False
