# chat/services/image_description_service.py
import logging
import io
from PIL import Image
from google import genai
from google.genai import types
from django.conf import settings

logger = logging.getLogger(__name__)

class ImageDescriptionService:
    def __init__(self):
        try:
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                 raise ValueError("GEMINI_API_KEY not found")
            self.client = genai.Client(api_key=api_key)
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Client for image description: {e}")
            self.client = None

    def describe_image(self, image_file) -> str:
        """
        Gera uma descrição textual detalhada para indexação RAG de uma imagem.
        Aceita um objeto file-like (Django UploadedFile ou path string).
        """
        if not self.client:
            logger.error("Gemini Client not initialized.")
            return ""

        try:
            # 1. Prepare Image
            if isinstance(image_file, str):
                # Path string
                with open(image_file, 'rb') as f:
                    img_data = f.read()
                    mime_type = 'image/jpeg' # Simplification, detect if needed
            else:
                # File object (Django)
                image_file.seek(0)
                img_data = image_file.read()
                mime_type = getattr(image_file, 'content_type', 'image/jpeg')
                image_file.seek(0) # Reset pointer

            # 2. Call Gemini with specific prompt for factual description
            prompt = """Describe the image factually.

Include:
- OCR (exact visible text)
- Objects
- Scene / context
- Tables or charts (if any)
- Keywords

Do not infer or assume information that is not visually present."""

            response = self.client.models.generate_content(
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
