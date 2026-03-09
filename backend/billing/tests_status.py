from django.test import TestCase
from django.urls import reverse
from accounts.models import User
from rest_framework.test import APIClient

class StatusEndpointTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create(username='status_user', email='status@example.com')
        self.client.force_authenticate(user=self.user)

    def test_status_endpoint(self):
        # Using the new path
        response = self.client.get('/api/v1/billing/status/')

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Verify structure
        self.assertIn('plan', data)
        self.assertIn('trial_days_left', data)
        self.assertIn('limits', data)
        self.assertIn('usage', data)
        self.assertIn('flags', data)

        # Default user should be in trial (or pre-trial)
        self.assertEqual(data['plan'], 'trial')
