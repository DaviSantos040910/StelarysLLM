from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from billing.services.google_play import GooglePlayService, BASIC_PLAN_CODE
from billing.models import Subscription, Plan
from billing.api.views import GooglePlayVerifyView
from rest_framework.test import APIRequestFactory, force_authenticate
from datetime import timedelta
from django.utils import timezone

User = get_user_model()

class GooglePlayServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.plan = Plan.objects.create(code=BASIC_PLAN_CODE, name="Basic")
        self.service = GooglePlayService()
        self.service.service = MagicMock() # Mock the Google API client

    def test_handle_purchase_verification_success(self):
        mock_now = timezone.now()

        # Mock Google API response
        mock_expiry_ms = int((mock_now + timedelta(days=30)).timestamp() * 1000)
        self.service.service.purchases().subscriptions().get().execute.return_value = {
            'expiryTimeMillis': str(mock_expiry_ms),
            'paymentState': 1
        }

        sub = self.service.handle_purchase_verification(
            self.user, 'prod_123', 'token_abc'
        )

        self.assertEqual(sub.user, self.user)
        self.assertEqual(sub.plan, self.plan)
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)
        self.assertEqual(sub.product_id, 'prod_123')

        # Check date (approximate)
        self.assertAlmostEqual(
            sub.current_period_end.timestamp(),
            (mock_now + timedelta(days=30)).timestamp(),
            delta=5
        )

    def test_verify_view(self):
        factory = APIRequestFactory()
        view = GooglePlayVerifyView.as_view()

        # Mock service at the module level used by the view
        with patch('billing.api.views.google_play_service') as mock_service:
            mock_service.handle_purchase_verification.return_value = None # Just need it to not raise

            request = factory.post(
                '/api/v1/billing/google-play/verify/',
                {'product_id': 'abc', 'purchase_token': 'xyz'},
                format='json'
            )
            force_authenticate(request, user=self.user)
            response = view(request)

            self.assertEqual(response.status_code, 200)
            mock_service.handle_purchase_verification.assert_called_once()
