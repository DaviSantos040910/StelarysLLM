from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from accounts.utils import get_actor
from billing.services.entitlements import get_entitlements
from accounts.permissions import IsUserOrGuest

class EntitlementsView(APIView):
    """
    API endpoint to retrieve the current user's (or guest's) entitlement status.
    Returns: JSON containing plan, limits, usage, and capability flags.
    """
    permission_classes = [IsUserOrGuest]

    def get(self, request):
        actor_type, actor = get_actor(request)

        user = actor if actor_type == 'user' else None
        guest = actor if actor_type == 'guest' else None

        data = get_entitlements(user=user, guest_session=guest)
        return Response(data)
