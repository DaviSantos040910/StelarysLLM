import os
from abc import ABC, abstractmethod
import logging
from google.genai import types
from chat.services.ai_client import get_ai_client, get_model
from core.genai_models import GENAI_MODEL_TEXT

logger = logging.getLogger(__name__)

class LLMProvider(ABC):
    @abstractmethod
    def generate_text(self, contents, config=None, model=None):
        pass

    @abstractmethod
    def generate_json(self, contents, schema, config=None, model=None):
        pass

    @abstractmethod
    def generate_stream(self, contents, config=None, model=None):
        pass

class GeminiProvider(LLMProvider):
    """
    Wraps the existing chat.services.ai_client.get_ai_client() for Google Gemini/Vertex AI.
    """
    def __init__(self):
        # We get the client dynamically to ensure env changes or reloads are respected if needed,
        # but storing it here assumes a single client instance per provider instance.
        self.client = get_ai_client()

    def generate_text(self, contents, config=None, model=None):
        model_name = model or get_model('chat')
        if not config:
            config = types.GenerateContentConfig()

        response = self.client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config
        )
        return response.text

    def generate_json(self, contents, schema, config=None, model=None):
        model_name = model or get_model('chat')
        if not config:
            config = types.GenerateContentConfig()

        config.response_mime_type = "application/json"
        config.response_schema = schema

        response = self.client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config
        )

        # Parsed returns dict if schema is provided and successful
        if hasattr(response, 'parsed') and response.parsed:
            return response.parsed

        # Fallback to json loads if parsed is not populated (e.g. strict schema issues)
        import json
        return json.loads(response.text)

    def generate_stream(self, contents, config=None, model=None):
        model_name = model or get_model('chat')
        if not config:
            config = types.GenerateContentConfig()

        return self.client.models.generate_content_stream(
            model=model_name,
            contents=contents,
            config=config
        )

def get_llm_provider(backend_name=None):
    if backend_name is None:
        backend_name = os.getenv('AI_PROVIDER', 'gemini_api')

    # Currently only Gemini/Vertex is supported via the existing client
    # But this structure allows adding OpenAIProvider etc later.
    return GeminiProvider()
