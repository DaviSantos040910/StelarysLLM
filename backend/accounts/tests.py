import shutil
import tempfile
import io
from PIL import Image

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings

User = get_user_model()

# Create a temporary directory for media files during tests
TEMP_MEDIA_ROOT = tempfile.mkdtemp()

@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AccountTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        # Clean up the temporary media directory after tests
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.password = "securepassword123"
        self.username = "testuser"
        self.email = "test@example.com"
        self.user = User.objects.create_user(
            username=self.username,
            email=self.email,
            password=self.password
        )

        # We target the specific endpoints mentioned in the prompt.
        # Since 'login' and 'me' are named in accounts/urls.py, reverse should work.
        # However, due to multiple includes in config/urls.py, we want to be sure.
        # The prompt mentions /api/v1/accounts/me/
        self.login_url = "/api/v1/accounts/login/"
        self.me_url = "/api/v1/accounts/me/"

    def generate_image_file(self):
        file = io.BytesIO()
        image = Image.new('RGB', (100, 100), 'white')
        image.save(file, 'jpeg')
        file.name = 'test.jpg'
        file.seek(0)
        return SimpleUploadedFile(
            name='test.jpg',
            content=file.read(),
            content_type='image/jpeg'
        )

    def test_me_view_get_absolute_url(self):
        """
        Verify that GET /api/v1/accounts/me/ returns an absolute URL for the avatar.
        """
        # Assign an avatar manually
        avatar = self.generate_image_file()
        self.user.avatar = avatar
        self.user.save()

        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, 200)
        self.assertIn("avatar", response.data)
        self.assertIsNotNone(response.data["avatar"])

        # Check if it starts with http (absolute URL)
        avatar_url = response.data["avatar"]
        print(f"\n[GET /me] Avatar URL: {avatar_url}")
        self.assertTrue(avatar_url.startswith("http"))

    def test_me_view_patch_multipart(self):
        """
        Verify that PATCH /api/v1/accounts/me/ accepts multipart/form-data
        and correctly updates and returns an absolute avatar URL.
        """
        self.client.force_authenticate(user=self.user)

        new_avatar = self.generate_image_file()
        data = {
            "first_name": "UpdatedName",
            "avatar": new_avatar
        }

        # PATCH with multipart/form-data
        response = self.client.patch(self.me_url, data, format='multipart')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["first_name"], "UpdatedName")

        avatar_url = response.data.get("avatar")
        print(f"\n[PATCH /me] Avatar URL: {avatar_url}")

        self.assertIsNotNone(avatar_url)
        self.assertTrue(avatar_url.startswith("http"))

        self.user.refresh_from_db()
        self.assertTrue(bool(self.user.avatar))

    def test_login_view_absolute_url(self):
        """
        Verify that POST /api/v1/accounts/login/ returns the user object
        with an absolute URL for the avatar.
        """
        # Assign an avatar manually
        avatar = self.generate_image_file()
        self.user.avatar = avatar
        self.user.save()

        data = {
            "identifier": self.username,
            "password": self.password
        }
        response = self.client.post(self.login_url, data)

        self.assertEqual(response.status_code, 200)
        self.assertIn("user", response.data)

        user_data = response.data["user"]
        self.assertIn("avatar", user_data)

        avatar_url = user_data["avatar"]
        print(f"\n[POST /login] Avatar URL: {avatar_url}")

        self.assertIsNotNone(avatar_url)
        self.assertTrue(avatar_url.startswith("http"))
