# chat/services/image_service.py
"""
Serviço de geração de imagens com suporte a Gemini API e Vertex AI (Imagen 3).
"""

import os
import uuid
import logging
import base64
from pathlib import Path
from django.conf import settings
from google.genai import types
from .ai_client import get_ai_client, get_model, USE_VERTEX_AI

logger = logging.getLogger(__name__)


class ImageGenerationError(Exception):
    """Exceção para erros na geração de imagens."""
    pass


class ImageGenerationService:
    """
    Serviço de geração de imagens.
    - Gemini API: usa gemini-2.5-flash-image (generate_content)
    - Vertex AI: usa imagen-3.0-generate-002 (generate_images)
    """

    def __init__(self):
        self.client = get_ai_client()

    def generate_and_save_image(
        self,
        prompt: str,
        output_dir: str = "chat_attachments",
        aspect_ratio: str = "1:1"
    ) -> str:
        """
        Gera uma imagem e salva no diretório de mídia.

        Args:
            prompt: Descrição da imagem a ser gerada
            output_dir: Subdiretório dentro de MEDIA_ROOT
            aspect_ratio: Proporção da imagem (apenas Vertex AI/Imagen)

        Returns:
            str: Caminho relativo do arquivo salvo

        Raises:
            ImageGenerationError: Se houver erro na geração
        """
        try:
            logger.info(f"[ImageGen] Gerando imagem: {prompt[:80]}...")

            # Escolhe o método baseado na API configurada
            if USE_VERTEX_AI:
                image_bytes = self._generate_with_imagen(prompt, aspect_ratio)
            else:
                image_bytes = self._generate_with_gemini(prompt)

            # Salvar no disco
            return self._save_image(image_bytes, output_dir)

        except ImageGenerationError:
            raise
        except Exception as e:
            self._handle_error(e)

    def _generate_with_gemini(self, prompt: str) -> bytes:
        """
        Gera imagem usando Gemini API (gemini-2.5-flash-image).
        """
        model = get_model('image')
        logger.info(f"[ImageGen] Usando modelo Gemini: {model}")

        full_prompt = f"""Generate a high-quality image based on this description:

{prompt}

Create a visually appealing, detailed image that accurately represents the description."""

        response = self.client.models.generate_content(
            model=model,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=1.0,
                response_modalities=["IMAGE"]
            )
        )

        # Validação
        if not response.candidates or not response.candidates[0].content.parts:
            raise ImageGenerationError(
                "Nenhuma imagem foi gerada. Tente reformular seu pedido."
            )

        # Extração da imagem
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                inline_data = part.inline_data
                if hasattr(inline_data, 'data'):
                    return inline_data.data
                elif hasattr(inline_data, '_image_bytes'):
                    return inline_data._image_bytes

        raise ImageGenerationError("Resposta sem dados de imagem válidos.")

    def _generate_with_imagen(self, prompt: str, aspect_ratio: str) -> bytes:
        """
        Gera imagem usando Vertex AI (Imagen 3).
        Qualidade superior, mais opções de configuração.
        """
        model = get_model('image')
        logger.info(f"[ImageGen] Usando modelo Imagen: {model}")

        response = self.client.models.generate_images(
            model=model,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio=aspect_ratio,
                safety_filter_level="BLOCK_MEDIUM_AND_ABOVE",
                person_generation="ALLOW_ADULT"
            )
        )

        if not response.generated_images:
            raise ImageGenerationError(
                "Imagen não retornou resultado. Verifique o prompt."
            )

        # Extração dos bytes
        generated = response.generated_images[0]

        if hasattr(generated, 'image'):
            img = generated.image
            if hasattr(img, 'image_bytes'):
                return img.image_bytes
            elif hasattr(img, '_image_bytes'):
                return img._image_bytes
            elif hasattr(img, 'save'):
                # Fallback: salva temporariamente e lê
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                    img.save(tmp.name)
                    with open(tmp.name, 'rb') as f:
                        data = f.read()
                    os.unlink(tmp.name)
                    return data

        raise ImageGenerationError("Formato de resposta do Imagen não reconhecido.")

    def _save_image(self, image_bytes: bytes, output_dir: str) -> str:
        """Salva bytes de imagem no disco."""
        filename = f"{uuid.uuid4()}.png"
        relative_path = os.path.join(output_dir, filename)
        absolute_dir = Path(settings.MEDIA_ROOT) / output_dir
        absolute_path = absolute_dir / filename

        absolute_dir.mkdir(parents=True, exist_ok=True)

        with open(absolute_path, 'wb') as f:
            f.write(image_bytes)

        logger.info(f"[ImageGen] Salvo: {absolute_path} ({len(image_bytes)} bytes)")
        return relative_path

    def _handle_error(self, error: Exception):
        """Tratamento centralizado de erros."""
        error_msg = str(error).lower()

        if 'quota' in error_msg or 'rate' in error_msg:
            raise ImageGenerationError(
                "Limite de requisições atingido. Aguarde alguns minutos."
            )
        elif 'safety' in error_msg or 'blocked' in error_msg:
            raise ImageGenerationError(
                "Conteúdo bloqueado por políticas de segurança. Reformule o pedido."
            )
        elif 'not found' in error_msg or 'not supported' in error_msg:
            raise ImageGenerationError(
                "Modelo de imagem não disponível. Verifique sua configuração."
            )
        else:
            logger.error(f"[ImageGen] Erro: {error}", exc_info=True)
            raise ImageGenerationError(f"Erro na geração: {str(error)}")


# Singleton
image_service = ImageGenerationService()
