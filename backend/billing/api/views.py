from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from accounts.utils import get_actor
from billing.services.entitlements import get_entitlements
from accounts.permissions import IsUserOrGuest
from billing.services.google_play import google_play_service
import logging
import base64
import json
from django.utils import timezone
from datetime import datetime
from ..models import Subscription

logger = logging.getLogger(__name__)

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

class GooglePlayVerifyView(APIView):
    """
    Verifies a Google Play subscription purchase and updates the user's plan.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product_id')
        purchase_token = request.data.get('purchase_token')

        if not product_id or not purchase_token:
            return Response(
                {"error": "Missing product_id or purchase_token"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Calls the service to verify with Google and update DB
            google_play_service.handle_purchase_verification(
                user=request.user,
                product_id=product_id,
                purchase_token=purchase_token
            )

            # Return fresh status
            data = get_entitlements(user=request.user)
            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Purchase verification failed: {e}")
            return Response(
                {"error": "Verification failed", "detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class GooglePlayRTDNView(APIView):
    """
    Handles Real-Time Developer Notifications (RTDN) from Google Cloud Pub/Sub.
    """
    permission_classes = [permissions.AllowAny] # Pub/Sub auth handled via token/header usually, or unauthenticated webhook

    def post(self, request):
        try:
            # Pub/Sub message format
            message = request.data.get('message', {})
            data_b64 = message.get('data')

            if not data_b64:
                logger.warning("RTDN: No data in message")
                return Response(status=status.HTTP_400_BAD_REQUEST)

            data_str = base64.b64decode(data_b64).decode('utf-8')
            notification = json.loads(data_str)

            logger.info(f"RTDN Received: {notification}")

            # We care about subscriptionNotification
            sub_notif = notification.get('subscriptionNotification')
            if not sub_notif:
                return Response(status=status.HTTP_200_OK) # Ack other types

            notification_type = sub_notif.get('notificationType')
            purchase_token = sub_notif.get('purchaseToken')
            # subscriptionId = sub_notif.get('subscriptionId') # Product ID

            if not purchase_token:
                return Response(status=status.HTTP_200_OK)

            # Find subscription by token
            try:
                sub = Subscription.objects.get(purchase_token=purchase_token)
            except Subscription.DoesNotExist:
                logger.warning(f"RTDN: Subscription not found for token {purchase_token[:10]}...")
                return Response(status=status.HTTP_200_OK) # Ack to stop retries if we don't have it

            # Process Type
            # 1: RECOVERED, 2: RENEWED, 3: CANCELED, 4: PURCHASED, ...
            # We mostly care about RENEWAL (update date) and EXPIRY/REVOCATION

            if notification_type == 2: # SUBSCRIPTION_RENEWED
                # Call verify to get new expiry
                google_play_service.handle_purchase_verification(
                    sub.user, sub.product_id, purchase_token
                )

            elif notification_type == 3: # SUBSCRIPTION_CANCELED
                # User canceled, but still active until period end.
                # Usually we don't change status immediately unless we want to show "cancels at end".
                # We can update local state if we tracked autoRenewing.
                pass

            elif notification_type == 12: # SUBSCRIPTION_REVOKED
                sub.status = Subscription.Status.CANCELED
                sub.current_period_end = timezone.now()
                sub.save()

            elif notification_type == 13: # SUBSCRIPTION_EXPIRED
                sub.status = Subscription.Status.PAST_DUE # or INCOMPLETE
                sub.save()

            return Response(status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"RTDN Error: {e}")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)
