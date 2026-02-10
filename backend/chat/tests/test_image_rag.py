from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.image_description_service import image_description_service
import io

class ImageDescriptionTest(TestCase):
    @patch('chat.services.image_description_service.image_description_service.client')
    def test_describe_image_prompt(self, mock_client):
        """
        Verify that the prompt matches the user's requirement.
        """
        # Create dummy image data
        image_data = b"fake_image_bytes"
        image_file = io.BytesIO(image_data)

        # Mock Response
        mock_response = MagicMock()
        mock_response.text = "Factual description."
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        result = image_description_service.describe_image(image_file)

        # Verify call arguments
        args, kwargs = mock_client.models.generate_content.call_args

        # Check prompt content in the list of contents
        contents = kwargs['contents']
        prompt_text = contents[0]

        expected_prompt = """Describe the image factually.

Include:
- OCR (exact visible text)
- Objects
- Scene / context
- Tables or charts (if any)
- Keywords

Do not infer or assume information that is not visually present."""

        self.assertEqual(prompt_text, expected_prompt)
        self.assertEqual(result, "Factual description.")
