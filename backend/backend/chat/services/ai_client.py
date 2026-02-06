# chat/services/ai_client.py
"""
Cliente de IA centralizado com suporte a Gemini API e Vertex AI.
Alterne entre os dois mudando USE_VERTEX_AI nas settings.
"""

from google import genai
from google.genai import types
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)

# Flag para alternar entre Gemini API e Vertex AI
USE_VERTEX_AI = getattr(settings, 'USE_VERTEX_AI', False)

# Configurações Vertex AI
VERTEX_PROJECT_ID = getattr(settings, 'VERTEX_PROJECT_ID', '')
VERTEX_LOCATION = getattr(settings, 'VERTEX_LOCATION', 'us-central1')


def get_ai_client():
    """Retorna o client apropriado baseado na configuração."""
    if USE_VERTEX_AI:
        return _get_vertex_client()
    return _get_gemini_client()


def _get_gemini_client():
    """Cliente para Gemini API (gratuito/pago com API Key)."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY não encontrada nas variáveis de ambiente")
    return genai.Client(api_key=api_key)


def _get_vertex_client():
    """Cliente para Vertex AI (Google Cloud)."""
    if not VERTEX_PROJECT_ID:
        raise ValueError("VERTEX_PROJECT_ID não configurado no settings.py")
    return genai.Client(
        vertexai=True,
        project=VERTEX_PROJECT_ID,
        location=VERTEX_LOCATION
    )


def detect_intent(user_message: str) -> str:
    """
    Classifica a intenção do usuário: TEXT ou IMAGE.

    Args:
        user_message: Mensagem do usuário para análise

    Returns:
        'TEXT' ou 'IMAGE' indicando a intenção detectada
    """
    if not user_message or len(user_message.strip()) < 3:
        return "TEXT"

    try:
        client = get_ai_client()
        prompt = f"""Analise a mensagem abaixo e determine se o usuário está pedindo para CRIAR/GERAR uma imagem visual.

Mensagem: "{user_message}"

Regras:
- IMAGE: Se pedir explicitamente para criar, gerar, desenhar, fazer uma imagem
- TEXT: Para qualquer outro tipo de pergunta

Responda APENAS: TEXT ou IMAGE"""

        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=10)
        )

        if response.text:
            result = response.text.strip().upper()
            if result in ['TEXT', 'IMAGE']:
                return result

        return "TEXT"
    except Exception as e:
        logger.warning(f"[detect_intent] Erro: {e}")
        return "TEXT"


def generate_content_stream(contents, config, model_name=None, use_google_search: bool = False):
    """
    Gera conteúdo em modo streaming usando generate_content_stream().

    A biblioteca google-genai possui um método específico para streaming
    que retorna um generator. Cada chunk é um GenerateContentResponse.

    Args:
        contents: Conteúdo/histórico da conversa
        config: Configuração de geração (GenerateContentConfig)
        model_name: Nome do modelo (opcional)
        use_google_search: Se True, habilita o Google Search Grounding

    Yields:
        Texto de cada chunk conforme gerado pela IA
    """
    try:
        client = get_ai_client()
        model = model_name or get_model('chat')

        logger.info(f"[StreamClient] Usando generate_content_stream com modelo {model} | Web Search: {use_google_search}")

        # Configuração dinâmica de ferramentas
        tools = []
        if use_google_search:
            # Habilita a busca integrada (Grounding)
            tools.append(types.Tool(google_search=types.GoogleSearch()))

        # Atribui a lista de ferramentas (vazia ou com busca) à configuração
        # Isso garante que a busca seja desativada se use_google_search for False
        config.tools = tools

        # Usar o método específico de streaming
        stream = client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=config
        )

        # O stream é um generator que yields GenerateContentResponse objects
        chunk_count = 0
        for chunk in stream:
            chunk_count += 1

            # Cada chunk tem um atributo .text com o texto gerado
            if hasattr(chunk, 'text') and chunk.text:
                yield chunk.text
            else:
                # Fallback: tentar acessar via candidates
                try:
                    if hasattr(chunk, 'candidates') and chunk.candidates:
                        if chunk.candidates[0].content.parts:
                            text = chunk.candidates[0].content.parts[0].text
                            if text:
                                yield text
                except (IndexError, AttributeError) as e:
                    # Logs de debug apenas se necessário, chunks de grounding metadata podem vir vazios de texto
                    pass

        logger.info(f"[StreamClient] Streaming concluído: {chunk_count} chunks processados")

    except Exception as e:
        logger.error(f"[StreamClient] Erro no streaming: {e}", exc_info=True)
        raise


# Modelos disponíveis por tipo de API
MODELS = {
    'gemini_api': {
        'chat': 'gemini-2.5-flash-lite',
        'chat_pro': 'gemini-2.5-pro',
        'image': 'gemini-2.5-flash-image',
        'embedding': 'gemini-embedding-001',
        'tts': 'gemini-2.5-flash-preview-tts',
        'lite': 'gemini-2.5-flash-lite',
    },
    'vertex_ai': {
        'chat': 'gemini-2.5-flash-lite',
        'chat_pro': 'gemini-2.5-pro',
        'image': 'imagen-3.0-generate-002',
        'embedding': 'text-embedding-004',
        'tts': 'gemini-2.5-flash-preview-tts',
        'lite': 'gemini-2.5-flash-lite',
    }
}


def get_model(model_type: str) -> str:
    """
    Retorna o modelo apropriado baseado no tipo de API configurado.

    Args:
        model_type: Tipo do modelo ('chat', 'image', 'embedding', etc.)

    Returns:
        Nome do modelo para a API configurada
    """
    api_type = 'vertex_ai' if USE_VERTEX_AI else 'gemini_api'
    return MODELS[api_type].get(model_type, MODELS[api_type]['chat'])