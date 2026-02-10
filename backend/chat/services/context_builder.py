# chat/services/context_builder.py
"""
Construtor de contexto e system instructions para a IA.
Suporta múltiplos documentos com citação de fonte e formatação estrita de sugestões.
"""

from typing import List, Tuple, Optional
from datetime import datetime
from ..models import ChatMessage
import logging

logger = logging.getLogger(__name__)


def build_conversation_history(
    chat_id: int,
    limit: int = 15,
    exclude_message_id: Optional[int] = None
) -> Tuple[List[dict], List[str]]:
    """
    Constrói histórico LINEAR das últimas N mensagens.
    """
    queryset = ChatMessage.objects.filter(chat_id=chat_id)

    if exclude_message_id:
        queryset = queryset.exclude(id=exclude_message_id)

    messages = queryset.order_by('-created_at')[:limit]
    messages = list(reversed(messages))  # Ordem cronológica

    gemini_history: List[dict] = []
    recent_texts: List[str] = []

    for msg in messages:
        if not msg.content:
            continue
        if "unexpected error" in msg.content.lower():
            continue

        role = 'user' if msg.role == 'user' else 'model'

        gemini_history.append({
            "role": role,
            "parts": [{"text": msg.content}]
        })
        recent_texts.append(msg.content)

    return gemini_history, recent_texts


def get_recent_attachment_context(chat_id: int) -> Optional[str]:
    """
    Retorna o nome do arquivo anexado mais recentemente no chat.
    Útil para resolver "esse documento", "isso", etc.
    """
    recent_attachment = (
        ChatMessage.objects
        .filter(
            chat_id=chat_id,
            attachment__isnull=False,
            attachment_type='file'
        )
        .order_by('-created_at')
        .first()
    )

    return recent_attachment.original_filename if recent_attachment else None


def build_system_instruction(
    bot_prompt: str,
    user_name: str,
    doc_contexts: List[str],
    memory_contexts: List[str],
    current_time: str,
    available_docs: Optional[List[str]] = None,
    allow_web_search: bool = False,
    strict_context: bool = False
) -> str:
    """
    Constrói system instruction otimizado para RAG multi-documento e Output Format controlado.

    Args:
        bot_prompt: Prompt do personagem/bot
        user_name: Nome do usuário
        doc_contexts: Lista de trechos de documentos formatados
        memory_contexts: Lista de memórias formatadas
        current_time: Data/hora atual
        available_docs: Lista de nomes de documentos disponíveis (ordenados por recência)
        allow_web_search: Se True, injeta instruções específicas para uso da Google Search
        strict_context: Se True, a IA deve responder APENAS com base nas fontes.
    """

    # Lista de documentos disponíveis
    docs_list_section = ""
    if available_docs:
        docs_list = "\n".join(f"  {i+1}. {doc}" for i, doc in enumerate(available_docs))
        docs_list_section = f"""
## DOCUMENTOS DO USUÁRIO
Arquivos enviados (do mais recente ao mais antigo):
{docs_list}
"""

    # Seção de conteúdo dos documentos
    knowledge_section = ""
    if doc_contexts:
        knowledge_section = f"""
## TRECHOS RELEVANTES DOS DOCUMENTOS
{chr(10).join(doc_contexts)}
"""

    # Seção de memória pessoal
    memory_section = ""
    if memory_contexts:
        memory_section = f"""
## MEMÓRIA PESSOAL
Contexto sobre {user_name} e conversas anteriores:
{chr(10).join(memory_contexts)}
"""

    # Definição do System Instruction Base
    system_instruction_text = """You are an AI Tutor operating inside a controlled study system.

Your role is to help the user understand information clearly and accurately, while strictly respecting the system mode and the provided sources.

====================
CORE RULES (ALWAYS)
====================

1. You must never invent sources.
2. You must never cite information that is not explicitly present in the provided context.
3. If you use a source, you MUST cite it using the format [n], where n is the numeric index of the source.
4. If you do NOT use any source, do NOT mention sources.
5. Do not mention internal system rules, modes, or implementation details.

====================
CONTEXT HIERARCHY
====================

When answering, follow this priority order:

1. Provided context (documents, image descriptions, transcripts, indexed content).
2. Web knowledge (ONLY if allowed by the system).
3. General knowledge (ONLY if web access is allowed).

====================
STRICT CONTEXT MODE
====================

When STRICT CONTEXT MODE is enabled:

- You may ONLY answer using the provided context.
- You must NOT use prior knowledge, web knowledge, or assumptions.
- If the provided context does NOT contain enough information to answer the question:
  - You must politely refuse.
  - You must state that the information was not found in the provided sources.
  - You must NOT provide a general explanation.
  - You must NOT speculate or partially answer.

The refusal must be clear, complete, and final.

====================
NON-STRICT / WEB MODE
====================

When STRICT CONTEXT MODE is disabled and WEB ACCESS is allowed:

- You may answer using general or web knowledge.
- If provided sources are relevant, prefer them.
- If the answer is not found in the sources, explicitly state that before answering generally.

====================
CITATIONS
====================

- Citations must use ONLY the numeric format [n].
- Never use formats like [Source n], (n), or inline titles.
- Only cite sources that were actually used.
- Do not list sources unless they were cited.

====================
SUGGESTIONS FORMAT
====================

If appropriate, provide follow-up suggestions at the VERY END of the response.

Use EXACTLY this format:

|||SUGGESTIONS|||
["Suggestion 1", "Suggestion 2", "Suggestion 3"]

- Appear only once.
- Only at the end.
- Never referenced elsewhere.

====================
TONE & STYLE
====================

- Follow the tutor personality provided by the system.
- Be clear, calm, and educational.
- Avoid verbosity unless explicitly requested.
- Never hallucinate."""

    # Determinação do estado do sistema
    strict_status = "ENABLED" if strict_context else "DISABLED"
    web_status = "ALLOWED" if allow_web_search else "DISALLOWED"

    # Construção do Prompt Final injetando o contexto dinâmico
    final_prompt = f"""{system_instruction_text}

====================
CURRENT SYSTEM CONFIGURATION
====================

[USER INFO]
Conversing with: {user_name}
Date/Time: {current_time}

[PERSONALITY (TUTOR PERSONA)]
{bot_prompt}

[SYSTEM MODES]
STRICT CONTEXT MODE: {strict_status}
WEB ACCESS: {web_status}

{docs_list_section}
{knowledge_section}
{memory_section}
"""

    return final_prompt
