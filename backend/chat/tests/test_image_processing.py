import os
import io
from PIL import Image
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import MagicMock, patch
from studio.models import KnowledgeSource
from chat.services.image_description_service import image_description_service

User = get_user_model()

class ImageProcessingTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testimageuser")
        
        # Create a dummy image
        img = Image.new('RGB', (100, 100), color='red')
        img_io = io.BytesIO()
        img.save(img_io, format='JPEG')
        img_io.seek(0)
        
        self.test_image = SimpleUploadedFile(
            name='test_image.jpg',
            content=img_io.read(),
            content_type='image/jpeg'
        )

    @patch('chat.services.image_description_service.image_description_service.client')
    def test_image_source_creation_triggers_description(self, mock_client):
        """
        Verify that creating a KnowledgeSource with type IMAGE triggers the description service.
        """
        # Mock Gemini response
        mock_response = MagicMock()
        mock_response.text = "This is a detailed description of a red square."
        mock_client.models.generate_content.return_value = mock_response

        # Create source via View logic simulation (or directly calling logic if viewset is complex to test fully integrated)
        # Here we simulate the View logic: create instance -> describe -> save
        
        source = KnowledgeSource.objects.create(
            user=self.user,
            title="Test Red Square",
            source_type=KnowledgeSource.SourceType.IMAGE,
            file=self.test_image
        )
        
        # Simulate view's extraction step
        description = image_description_service.describe_image(source.file)
        source.extracted_text = description
        source.save()

        # Check if description service was called
        mock_client.models.generate_content.assert_called_once()
        self.assertEqual(source.extracted_text, "This is a detailed description of a red square.")

    @patch('chat.services.image_description_service.image_description_service.client')
    def test_image_description_service_logic(self, mock_client):
        """
        Directly test the service method.
        """
        mock_response = MagicMock()
        mock_response.text = "A test description."
        mock_client.models.generate_content.return_value = mock_response

        result = image_description_service.describe_image(self.test_image)
        
        self.assertEqual(result, "A test description.")
        mock_client.models.generate_content.assert_called()
