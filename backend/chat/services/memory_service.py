# chat/services/memory_service.py

import logging
from google.genai import types

from .ai_client import get_ai_client
from ..vector_service import VectorService

logger = logging.getLogger(__name__)

# Instância global do serviço vetorial, igual ao ai_service.py
vector_service = VectorService()


def _summarize_fact(text: str, role: str = 'user') -> str:
    """
    Usa a IA para extrair um fato conciso e duradouro do texto.
    Lógica idêntica a _summarize_fact em ai_service.py.
    """
    if not text or len(text) < 15:
        return ""

    try:
        client = get_ai_client()

        prompt = f"""Analise o texto abaixo e extraia APENAS fatos concretos e duradouros que valem a pena lembrar.

Texto ({role}): "{text}"

REGRAS:
- Retorne "NO_FACT" para: saudações, agradecimentos, perguntas genéricas, conversa casual
- Retorne "NO_FACT" se for apenas uma pergunta sem informação nova
- Fatos devem ser em terceira pessoa: "O usuário tem um cachorro chamado Rex"
- Máximo 1 frase concisa (menos de 20 palavras)
- Foque em: preferências, informações pessoais, contextos importantes, planos

Responda APENAS com o fato extraído ou "NO_FACT"."""

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0)
        )

        summary = response.text.strip()
        if "NO_FACT" in summary.upper() or len(summary) < 10:
            return ""

        # Remove aspas e formatação extra
        summary = summary.strip('"\'')
        return summary

    except Exception as e:
        logger.warning(f"[Memory Summary Error] {e}")
        return ""


def process_memory_background(user_id, bot_id, user_text, ai_text):
    """
    Função executada em thread separada para processar e salvar memórias.
    Lógica idêntica a _process_memory_background em ai_service.py.
    """
    try:
        # 1. Processar mensagem do Usuário (prioridade)
        if user_text and len(user_text) > 25:
            fact = _summarize_fact(user_text, 'user')
            if fact:
                vector_service.add_memory(user_id, bot_id, fact, 'user')
                logger.debug(f"[Memory] Fato do usuário salvo: {fact[:50]}...")

        # 2. Processar mensagem da IA (apenas se contiver informação nova significativa)
        if ai_text and len(ai_text) > 80:
            fact = _summarize_fact(ai_text, 'assistant')
            if fact:
                vector_service.add_memory(user_id, bot_id, fact, 'assistant')
                logger.debug(f"[Memory] Fato da IA salvo: {fact[:50]}...")

    except Exception as e:
        logger.error(f"[Background Memory Error] {e}")
