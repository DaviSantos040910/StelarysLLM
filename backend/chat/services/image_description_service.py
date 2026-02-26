# chat/services/image_description_service.py
import logging
import io
from PIL import Image
from google import genai
from google.genai import types
from django.conf import settings
from chat.services.ai_client import get_ai_client

logger = logging.getLogger(__name__)

class ImageDescriptionService:
    def __init__(self):
        # Lazy client initialization is handled by get_ai_client
        pass

    def describe_image(self, image_file) -> str:
        client = get_ai_client()
        if not client:
            logger.error("Gemini Client not initialized.")
            return ""
        """
        Gera uma descrição textual detalhada para indexação RAG de uma imagem.
        Aceita um objeto file-like (Django UploadedFile ou path string).
        """
        try:
            # 1. Prepare Image
            if isinstance(image_file, str):
                # Path string
                with open(image_file, 'rb') as f:
                    img_data = f.read()
                    mime_type = 'image/jpeg' # Simplification, detect if needed
            else:
                # File object (Django)
                # Ensure we are at the start of the file
                if hasattr(image_file, 'seek'):
                    image_file.seek(0)

                img_data = image_file.read()
                mime_type = getattr(image_file, 'content_type', 'image/jpeg')

                # Reset pointer
                if hasattr(image_file, 'seek'):
                    image_file.seek(0)

            # 2. Call Gemini with specific prompt for factual description
            prompt = """Describe the image factually.

Include:
- OCR (exact visible text)
- Objects
- Scene / context
- Tables or charts (if any)
- Keywords

Do not infer or assume information that is not visually present."""

            response = client.models.generate_content(
                model='gemini-2.5-flash-lite',
                contents=[
                    prompt,
                    types.Part.from_bytes(data=img_data, mime_type=mime_type)
                ]
            )
            
            return response.text if response.text else ""

        except Exception as e:
            logger.error(f"Error describing image: {e}")
            return ""

# Singleton
image_description_service = ImageDescriptionService()
