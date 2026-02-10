import json
import logging
from typing import List, Dict, Tuple
from google import genai
from google.genai import types
from django.conf import settings
from .ai_client import get_ai_client
from .evidence_gate import EvidenceDecision

logger = logging.getLogger(__name__)

class EvidenceTiebreakerAI:
    """
    AI Judge to decide if ambiguous context (UNCERTAIN) is sufficient for a Strict Mode answer.
    """

    def __init__(self):
        self.client = get_ai_client()

    def decide(self, question: str, doc_contexts: List[Dict]) -> Tuple[EvidenceDecision, float, str]:
        """
        Calls LLM to judge evidence sufficiency.

        Returns:
            (Decision, Confidence, Reason)
        """
        if not self.client or not doc_contexts:
            return EvidenceDecision.REFUSE, 0.0, "no_client_or_context"

        prompt = self._prepare_prompt(question, doc_contexts)

        try:
            response_json = self._call_llm(prompt)
            decision, confidence, reason = self._parse_decision(response_json)

            # Security Rule: Only accept ANSWER if confidence is high enough
            if decision == EvidenceDecision.ANSWER and confidence < 0.65:
                return EvidenceDecision.REFUSE, confidence, f"low_confidence_answer ({reason})"

            return decision, confidence, reason

        except Exception as e:
            logger.error(f"[Tiebreaker] Error: {e}")
            return EvidenceDecision.REFUSE, 0.0, "tiebreaker_error"

    def _prepare_prompt(self, question: str, doc_contexts: List[Dict]) -> str:
        # Truncate Question
        q_excerpt = question[:250].replace('"', "'")
        if len(question) > 250: q_excerpt += "..."

        # Truncate Chunks (Top 2 only)
        chunks_text = ""
        for i, doc in enumerate(doc_contexts[:2]):
            title = doc.get('source', 'Unknown')[:50]
            dist = doc.get('score', 0.0)
            text = doc.get('content', '')[:350].replace('\n', ' ').replace('"', "'")
            chunks_text += f'\n[Chunk {i+1}] title="{title}" distance={dist:.3f}\ntext="{text}..."\n'

        return f"""Return JSON in this exact schema:
{{"decision":"ANSWER"|"REFUSE","confidence":0.0-1.0,"reason":"short_string"}}

User question (excerpt):
"{q_excerpt}"

Top context chunks:{chunks_text}

Make the decision."""

    def _call_llm(self, user_prompt: str) -> Dict:
        system_instruction = (
            "You are a strict evidence judge. "
            "Decide if the provided context contains enough evidence to answer the user's question in strict mode.\n"
            "Rules:\n"
            "- You must output ONLY valid JSON.\n"
            "- You must NOT answer the question.\n"
            "- You must NOT add any new facts.\n"
            "- If the context does not directly support an answer, choose REFUSE.\n"
            "- If the context likely contains enough to answer with citations, choose ANSWER."
        )

        response = self.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Content(role="user", parts=[types.Part(text=system_instruction + "\n\n" + user_prompt)])
            ],
            config=types.GenerateContentConfig(
                temperature=0.0, # Deterministic
                max_output_tokens=100,
                response_mime_type="application/json"
            )
        )

        if not response.text:
            raise ValueError("Empty response from Tiebreaker")

        # Clean markdown code blocks if present
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]

        return json.loads(text)

    def _parse_decision(self, data: Dict) -> Tuple[EvidenceDecision, float, str]:
        decision_str = data.get("decision", "REFUSE").upper()
        confidence = float(data.get("confidence", 0.0))
        reason = str(data.get("reason", "no_reason"))[:140]

        if decision_str == "ANSWER":
            return EvidenceDecision.ANSWER, confidence, reason
        else:
            return EvidenceDecision.REFUSE, confidence, reason

evidence_tiebreaker = EvidenceTiebreakerAI()
