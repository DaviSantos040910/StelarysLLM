from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.evidence_tiebreaker_ai import evidence_tiebreaker, EvidenceDecision

class EvidenceTiebreakerTest(TestCase):
    def setUp(self):
        self.doc_contexts = [{'content': 'Relevant info', 'source': 'Doc1', 'score': 0.4}]

    @patch('chat.services.evidence_tiebreaker_ai.evidence_tiebreaker.client')
    def test_decide_answer_high_confidence(self, mock_client):
        # Mock LLM response: ANSWER with 0.9 confidence
        mock_response = MagicMock()
        mock_response.text = '{"decision": "ANSWER", "confidence": 0.9, "reason": "Clear evidence"}'
        mock_client.models.generate_content.return_value = mock_response

        decision, conf, reason = evidence_tiebreaker.decide("Question", self.doc_contexts)

        self.assertEqual(decision, EvidenceDecision.ANSWER)
        self.assertEqual(conf, 0.9)
        self.assertEqual(reason, "Clear evidence")

    @patch('chat.services.evidence_tiebreaker_ai.evidence_tiebreaker.client')
    def test_decide_answer_low_confidence(self, mock_client):
        # Mock LLM response: ANSWER with 0.5 confidence (Should fail guardrail)
        mock_response = MagicMock()
        mock_response.text = '{"decision": "ANSWER", "confidence": 0.5, "reason": "Maybe"}'
        mock_client.models.generate_content.return_value = mock_response

        decision, conf, reason = evidence_tiebreaker.decide("Question", self.doc_contexts)

        self.assertEqual(decision, EvidenceDecision.REFUSE) # Guardrail triggered
        self.assertIn("low_confidence_answer", reason)

    @patch('chat.services.evidence_tiebreaker_ai.evidence_tiebreaker.client')
    def test_decide_refuse(self, mock_client):
        # Mock LLM response: REFUSE
        mock_response = MagicMock()
        mock_response.text = '{"decision": "REFUSE", "confidence": 0.9, "reason": "Irrelevant"}'
        mock_client.models.generate_content.return_value = mock_response

        decision, conf, reason = evidence_tiebreaker.decide("Question", self.doc_contexts)

        self.assertEqual(decision, EvidenceDecision.REFUSE)
        self.assertEqual(reason, "Irrelevant")

    @patch('chat.services.evidence_tiebreaker_ai.evidence_tiebreaker.client')
    def test_decide_invalid_json(self, mock_client):
        # Mock LLM response: Garbage
        mock_response = MagicMock()
        mock_response.text = 'Not JSON'
        mock_client.models.generate_content.return_value = mock_response

        decision, conf, reason = evidence_tiebreaker.decide("Question", self.doc_contexts)

        self.assertEqual(decision, EvidenceDecision.REFUSE)
        self.assertEqual(reason, "tiebreaker_error")
