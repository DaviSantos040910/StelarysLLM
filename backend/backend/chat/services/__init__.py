# chat/services/__init__.py
"""
Serviços de apoio para o módulo de chat:
- ai_client: cliente Gemini
- chat_service: fluxo principal de resposta da IA
- memory_service: processamento de memória em background
- tts_service: Text-to-Speech
- transcription_service: Speech-to-Text
- context_builder: histórico e system instructions
"""

from .ai_client import get_ai_client
# Adicione 'process_message_stream' à lista de importações abaixo
from .chat_service import (
    get_ai_response,
    handle_voice_interaction,
    handle_voice_message,
    generate_suggestions_for_bot,
    process_message_stream
)
from .memory_service import process_memory_background
from .tts_service import generate_tts_audio
from .transcription_service import transcribe_audio_gemini
from .context_builder import build_conversation_history, build_system_instruction