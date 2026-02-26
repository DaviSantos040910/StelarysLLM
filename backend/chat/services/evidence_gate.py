from enum import Enum
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class EvidenceDecision(Enum):
    ANSWER = "ANSWER"
    REFUSE = "REFUSE"
    UNCERTAIN = "UNCERTAIN"

class EvidenceGate:
    """
    Decide deterministicamente se há evidência suficiente para responder em modo estrito.
    Evita alucinações e inconsistências.
    """

    @staticmethod
    def evaluate(doc_contexts: List[Dict], threshold_strict: float = 0.45) -> Tuple[EvidenceDecision, str]:
        """
        Avalia a qualidade do contexto retornado com 2 thresholds e regras de zona cinzenta.

        Args:
            doc_contexts: Lista de chunks com 'score' (distância cosine, menor é melhor).
            threshold_strict: Threshold base (ex: 0.45).

        Returns:
            (Decision, Reason)
        """
        # 1. Se doc_contexts vazio -> REFUSE
        if not doc_contexts:
            return EvidenceDecision.REFUSE, "no_context"

        # 2. Extrair métricas (PRÉ-CÁLCULOS)
        # Assumindo que 'score' é a distância (menor é melhor)
        # Se não tiver score, assume 1.0 (pior caso)
        distances = [d.get('score', 1.0) for d in doc_contexts]

        # k = min(len(distances), 4)
        k = min(len(distances), 4)

        # best = min(distances)
        best = min(distances) if distances else 1.0

        # second = segundo menor se existir senão None
        # distances might not be sorted, so sort them first
        sorted_distances = sorted(distances)
        second = sorted_distances[1] if len(sorted_distances) > 1 else None

        # avg_topk = média das k menores distâncias
        top_k_distances = sorted_distances[:k]
        avg_topk = sum(top_k_distances) / len(top_k_distances) if top_k_distances else 1.0

        # gap = (second - best) se second existir senão None (use 0.0 or handle in logic)
        gap = (second - best) if second is not None else 0.0

        # unique_sources = número de source_id distintos nos top k
        # We need to map back to contexts to find source_ids of top k
        # Create (dist, context) pairs and sort
        scored_contexts = []
        for d in doc_contexts:
            scored_contexts.append((d.get('score', 1.0), d))
        scored_contexts.sort(key=lambda x: x[0])

        top_k_contexts = [ctx for _, ctx in scored_contexts[:k]]
        unique_sources = len(set(ctx.get('source_id') for ctx in top_k_contexts))

        # top_text_len = len(text do chunk com best) (após strip)
        best_context = scored_contexts[0][1] # Since we sorted, first is best
        top_text_len = len(best_context.get('content', '').strip())

        # 3. THRESHOLDS (valores iniciais melhores)
        # T_answer = threshold_strict * 1.02
        T_answer = threshold_strict * 1.02

        # T_refuse = threshold_strict * 1.18
        T_refuse = threshold_strict * 1.18

        reason_debug = (
            f"best={best:.3f}, avg={avg_topk:.3f}, gap={gap:.3f}, "
            f"uniq={unique_sources}, len={top_text_len}, "
            f"T_ans={T_answer:.3f}, T_ref={T_refuse:.3f}"
        )

        # LOGS (controlados)
        logger.info(f"[EvidenceGate] Eval: {reason_debug}")

        # 4. DECISÃO (DETERMINÍSTICA)

        # 2) Se best <= T_answer: ANSWER
        if best <= T_answer:
            return EvidenceDecision.ANSWER, f"best<=T_answer ({reason_debug})"

        # 3) Se best >= T_refuse: REFUSE
        if best >= T_refuse:
            return EvidenceDecision.REFUSE, f"best>=T_refuse ({reason_debug})"

        # 4) ZONA CINZENTA (T_answer < best < T_refuse)

        # 4.1) Se unique_sources >= 2: ANSWER
        if unique_sources >= 2:
            return EvidenceDecision.ANSWER, f"multi_source_support ({reason_debug})"

        # 4.2) Se top_text_len < 220: REFUSE
        if top_text_len < 220:
             return EvidenceDecision.REFUSE, f"top_chunk_too_short ({reason_debug})"

        # 4.3) Se avg_topk <= threshold_strict * 1.10: ANSWER
        if avg_topk <= (threshold_strict * 1.10):
            return EvidenceDecision.ANSWER, f"avg_topk_good ({reason_debug})"

        # 4.4) Se gap existe e gap <= 0.035: ANSWER
        # Check gap condition only if second exists (implied by gap logic usually, but let's be safe)
        if second is not None and gap <= 0.035:
             return EvidenceDecision.ANSWER, f"small_gap_consistent ({reason_debug})"

        # 4.5) Caso contrário: UNCERTAIN
        return EvidenceDecision.UNCERTAIN, f"gray_zone_uncertain ({reason_debug})"

evidence_gate = EvidenceGate()
