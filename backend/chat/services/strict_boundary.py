from enum import Enum
from typing import Tuple, List, Dict, Optional
import logging

from chat.services.intent_service import intent_service
from chat.vector_service import vector_service
from chat.services.evidence_gate import evidence_gate, EvidenceDecision
from chat.services.evidence_tiebreaker_ai import evidence_tiebreaker

logger = logging.getLogger(__name__)

class ResponseMode(Enum):
    LIST_SOURCES = "LIST_SOURCES"
    STRICT_REFUSAL = "STRICT_REFUSAL"
    STRICT_ANSWER_WITH_CONTEXT = "STRICT_ANSWER_WITH_CONTEXT"
    NON_STRICT_WEB_OR_GENERAL = "NON_STRICT_WEB_OR_GENERAL"

class StrictBoundary:

    def decide_response_mode(
        self,
        user_text: str,
        strict_context: bool,
        allow_web_search: bool,
        user_id: int,
        bot_id: int,
        study_space_ids: List[int]
    ) -> Tuple[ResponseMode, List[Dict], float, str]:
        """
        Decide o modo de resposta ANTES de chamar qualquer LLM.

        Returns:
            (Mode, DocContexts, BestScore, Reason)
        """

        # 1. Strict Mode Logic
        if strict_context:
            # 1.1 Intent check
            if intent_service.is_sources_list_intent(user_text):
                return ResponseMode.LIST_SOURCES, [], 0.0, "intent_list_sources"

            # 1.2 Evidence Check (RAG)
            doc_contexts, _ = vector_service.search_context(
                query_text=user_text,
                user_id=user_id,
                bot_id=bot_id,
                study_space_ids=study_space_ids,
                limit=6
            )

            # Default threshold for strict mode (can be tuned per bot later)
            THRESHOLD_STRICT = 0.45

            decision, reason = evidence_gate.evaluate(doc_contexts, THRESHOLD_STRICT)

            best_score = min([d.get('score', 1.0) for d in doc_contexts]) if doc_contexts else 1.0

            if decision == EvidenceDecision.ANSWER:
                return ResponseMode.STRICT_ANSWER_WITH_CONTEXT, doc_contexts, best_score, reason
            elif decision == EvidenceDecision.REFUSE:
                return ResponseMode.STRICT_REFUSAL, doc_contexts, best_score, reason
            else: # UNCERTAIN -> Tiebreaker AI
                tie_decision, conf, tie_reason = evidence_tiebreaker.decide(user_text, doc_contexts)
                final_reason = f"{reason} -> Tiebreaker: {tie_decision.name} ({conf:.2f}, {tie_reason})"

                if tie_decision == EvidenceDecision.ANSWER:
                    return ResponseMode.STRICT_ANSWER_WITH_CONTEXT, doc_contexts, best_score, final_reason
                else:
                    return ResponseMode.STRICT_REFUSAL, doc_contexts, best_score, final_reason

        # 2. Non-Strict Mode
        else:
            # Even in non-strict, we fetch context if available, but decision is purely based on web/general permission
            # We don't block.
            if allow_web_search:
                return ResponseMode.NON_STRICT_WEB_OR_GENERAL, [], 0.0, "web_allowed"
            else:
                # If web disallowed, we still return NON_STRICT but might prefer RAG internally.
                # But here we just classify the MODE.
                return ResponseMode.NON_STRICT_WEB_OR_GENERAL, [], 0.0, "general_allowed"

    def build_strict_refusal(self, bot_name: str, question: str, lang: str = None, has_any_sources: bool = False) -> str:
        """
        Constrói mensagem de recusa. (Ported from chat_service to break dependency cycle if needed)
        """
        if not lang:
            lang = self.detect_lang(question)

        q_excerpt = self.safe_excerpt(question)
        prefix = f"{bot_name}: " if bot_name else ""

        templates = {
            "pt": {
                True: "{prefix}Não encontrei essa informação nas suas fontes para responder em modo restrito.\n\nPergunta: “{q}”\n\nPara eu ajudar com base nas fontes, você pode:\n- adicionar uma fonte relevante,\n- indicar onde isso aparece (arquivo/página/trecho),\n- ou reformular a pergunta usando termos presentes nos documentos.",
                False: "{prefix}No modo restrito, eu só posso responder usando fontes.\n\nPergunta: “{q}”\n\nPara eu ajudar, adicione uma fonte (PDF, imagem, link, etc.) e tente novamente."
            },
            "en": {
                True: "{prefix}I couldn’t find this information in your sources to answer in strict mode.\n\nQuestion: “{q}”\n\nTo help based on your sources, you can:\n- add a relevant source,\n- point to where this appears (file/page/section),\n- or rephrase using terms present in the documents.",
                False: "{prefix}In strict mode, I can only answer using sources.\n\nQuestion: “{q}”\n\nTo help, add a source (PDF, image, link, etc.) and try again."
            },
            "es": {
                True: "{prefix}No encontré esta información en tus fuentes para responder en modo estricto.\n\nPregunta: “{q}”\n\nPara ayudar basándome en tus fuentes, puedes:\n- agregar una fuente relevante,\n- indicar dónde aparece (archivo/página/sección),\n- o reformular usando términos presentes en los documentos.",
                False: "{prefix}En modo estricto, solo puedo responder usando fuentes.\n\nPregunta: “{q}”\n\nPara ayudar, agrega una fuente (PDF, imagen, enlace, etc.) e inténtalo de nuevo."
            }
        }

        template = templates.get(lang, templates["en"])[has_any_sources]
        return template.format(prefix=prefix, q=q_excerpt)

    def detect_lang(self, text: str) -> str:
        text = text.lower()
        es_markers = ["¿", "¡", "qué", "cómo", "por qué", "dónde", "fuente", "fuentes"]
        if any(m in text for m in es_markers): return "es"
        pt_markers = ["você", "não", "por que", "onde", "fonte", "fontes", "documento", "documentos", "tutor", "quais", "quem", "qual"]
        if any(m in text for m in pt_markers): return "pt"
        return "en"

    def safe_excerpt(self, text: str, max_len: int = 120) -> str:
        if not text: return ""
        cleaned = " ".join(text.split())
        if len(cleaned) > max_len: return cleaned[:max_len] + "…"
        return cleaned

strict_boundary = StrictBoundary()
