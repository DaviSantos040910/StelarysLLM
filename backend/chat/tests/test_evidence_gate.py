from django.test import TestCase
from chat.services.evidence_gate import evidence_gate, EvidenceDecision

class EvidenceGateTest(TestCase):
    def setUp(self):
        self.threshold = 0.45
        self.t_answer = self.threshold * 1.02 # 0.459
        self.t_refuse = self.threshold * 1.18 # 0.531

    def test_empty_context(self):
        decision, reason = evidence_gate.evaluate([], self.threshold)
        self.assertEqual(decision, EvidenceDecision.REFUSE)
        self.assertEqual(reason, "no_context")

    def test_strong_match_answer(self):
        # best <= T_answer
        contexts = [{'score': 0.40, 'source_id': '1', 'content': 'long text'}]
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.ANSWER)
        self.assertIn("best<=T_answer", reason)

    def test_weak_match_refuse(self):
        # best >= T_refuse
        contexts = [{'score': 0.60, 'source_id': '1', 'content': 'long text'}]
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.REFUSE)
        self.assertIn("best>=T_refuse", reason)

    def test_gray_zone_multi_source(self):
        # best in gray zone (e.g. 0.48), unique sources >= 2
        contexts = [
            {'score': 0.48, 'source_id': '1', 'content': 'long text'},
            {'score': 0.49, 'source_id': '2', 'content': 'long text'}
        ]
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.ANSWER)
        self.assertIn("multi_source_support", reason)

    def test_gray_zone_short_text(self):
        # best in gray zone, unique=1, text < 220
        contexts = [{'score': 0.48, 'source_id': '1', 'content': 'short' * 10}] # < 220
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.REFUSE)
        self.assertIn("top_chunk_too_short", reason)

    def test_gray_zone_avg_good(self):
        # best in gray zone, unique=1, text long, avg <= threshold * 1.10 (0.495)
        # avg of [0.48, 0.49] = 0.485 <= 0.495
        contexts = [
            {'score': 0.48, 'source_id': '1', 'content': 'long text' * 50},
            {'score': 0.49, 'source_id': '1', 'content': 'long text' * 50}
        ]
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.ANSWER)
        self.assertIn("avg_topk_good", reason)

    def test_gray_zone_consistent_gap(self):
        # best in gray zone, unique=1, text long, avg bad (> 0.495), gap <= 0.035
        # scores: [0.50, 0.51] -> avg 0.505 > 0.495. gap 0.01 <= 0.035
        contexts = [
            {'score': 0.50, 'source_id': '1', 'content': 'long text' * 50},
            {'score': 0.51, 'source_id': '1', 'content': 'long text' * 50}
        ]
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.ANSWER)
        self.assertIn("small_gap_consistent", reason)

    def test_gray_zone_uncertain(self):
        # best in gray zone (0.50), unique=1, text long, avg bad (0.55), gap large (0.10)
        contexts = [
            {'score': 0.50, 'source_id': '1', 'content': 'long text' * 50},
            {'score': 0.60, 'source_id': '1', 'content': 'long text' * 50}
        ]
        # avg = 0.55 > 0.495
        # gap = 0.10 > 0.035
        decision, reason = evidence_gate.evaluate(contexts, self.threshold)
        self.assertEqual(decision, EvidenceDecision.UNCERTAIN)
        self.assertIn("gray_zone_uncertain", reason)
