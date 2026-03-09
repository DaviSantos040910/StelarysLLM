import os
import shutil
from django.test import TestCase, override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from studio.models import KnowledgeArtifact
from chat.models import Chat, Bot

User = get_user_model()

TEST_MEDIA_ROOT = os.path.join(os.path.dirname(__file__), 'test_media')

@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ArtifactDownloadTest(TestCase):
    def setUp(self):
        # Setup Media Root
        if not os.path.exists(TEST_MEDIA_ROOT):
            os.makedirs(TEST_MEDIA_ROOT)

        # Create Users
        self.user = User.objects.create(email="user@example.com", username="user")
        self.other_user = User.objects.create(email="other@example.com", username="other")

        # Create Bot
        self.bot = Bot.objects.create(name="Test Bot", owner=self.user)

        # Create Chat
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

        # Create Artifact (Podcast)
        self.podcast_artifact = KnowledgeArtifact.objects.create(
            chat=self.chat,
            type=KnowledgeArtifact.ArtifactType.PODCAST,
            title="Test Podcast",
            status=KnowledgeArtifact.Status.READY,
            media_url="/media/podcasts/test_audio.mp3"
        )

        # Create Dummy Audio File
        self.podcast_path = os.path.join(TEST_MEDIA_ROOT, 'podcasts')
        if not os.path.exists(self.podcast_path):
            os.makedirs(self.podcast_path)
        with open(os.path.join(self.podcast_path, 'test_audio.mp3'), 'wb') as f:
            f.write(b'dummy audio content')

        # Create Artifact (Slide)
        self.slide_artifact = KnowledgeArtifact.objects.create(
            chat=self.chat,
            type=KnowledgeArtifact.ArtifactType.SLIDE,
            title="Test Slides",
            status=KnowledgeArtifact.Status.READY,
            content=[{"title": "Slide 1", "bullets": ["Point A", "Point B"]}]
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        if os.path.exists(TEST_MEDIA_ROOT):
            shutil.rmtree(TEST_MEDIA_ROOT)

    def test_download_podcast_success(self):
        url = f'/api/v1/studio/artifacts/{self.podcast_artifact.id}/download/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'audio/mpeg')
        self.assertEqual(response['Content-Disposition'], 'attachment; filename="Test Podcast.mp3"')
        # Handle StreamingContent (FileResponse)
        content = b''.join(response.streaming_content) if hasattr(response, 'streaming_content') else response.content
        self.assertEqual(content, b'dummy audio content')

    def test_download_slide_success(self):
        url = f'/api/v1/studio/artifacts/{self.slide_artifact.id}/download/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Content type for pptx can vary but usually application/vnd.openxmlformats-officedocument.presentationml.presentation
        self.assertTrue(len(response.getvalue()) > 0) # Check if content is generated
        self.assertIn('attachment; filename="Test Slides.pptx"', response['Content-Disposition'])

    def test_download_unauthorized_access(self):
        # Authenticate as other user
        self.client.force_authenticate(user=self.other_user)

        url = f'/api/v1/studio/artifacts/{self.podcast_artifact.id}/download/'
        response = self.client.get(url)

        # Should be 404 because get_queryset filters by user
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_missing_file_404(self):
        # Point to non-existent file
        self.podcast_artifact.media_url = "/media/podcasts/missing.mp3"
        self.podcast_artifact.save()

        url = f'/api/v1/studio/artifacts/{self.podcast_artifact.id}/download/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
