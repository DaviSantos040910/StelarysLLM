from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.vector_service import VectorService

class VectorThresholdTest(TestCase):
    def setUp(self):
        self.service = VectorService()
        # Mock collection directly on the service instance
        self.service.collection = MagicMock()
        # Mock embedding to avoid API calls
        self.service._get_embedding = MagicMock(return_value=[0.1, 0.2, 0.3])

    def test_search_general_good_match(self):
        """Test a strong match that should pass the gate."""
        # Setup mock results: Distance 0.2 (Very good)
        self.service.collection.query.return_value = {
            'documents': [['Content A']],
            'metadatas': [[{'source': 'Doc A', 'source_id': '1'}]],
            'distances': [[0.2]]
        }

        results = self.service._search_general("QUERY: What is physics?", user_id=1, bot_id=1, limit=5)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['content'], 'Content A')

    def test_search_general_bad_match_gate(self):
        """Test that poor matches (high distance) return empty list via Confidence Gate."""
        # Setup mock results: Distance 0.5 (Worse than 0.40 threshold)
        self.service.collection.query.return_value = {
            'documents': [['Irrelevant Content']],
            'metadatas': [[{'source': 'Doc B', 'source_id': '2'}]],
            'distances': [[0.5]]
        }

        results = self.service._search_general("QUERY: What is physics?", user_id=1, bot_id=1, limit=5)

        # Should be filtered out completely
        self.assertEqual(len(results), 0)

    def test_short_query_strict_threshold(self):
        """Test that short queries use a stricter threshold (0.35)."""
        # Distance 0.38: Acceptable for long query (0.40), but rejected for short (0.35)
        self.service.collection.query.return_value = {
            'documents': [['Maybe Relevant']],
            'metadatas': [[{'source': 'Doc C', 'source_id': '3'}]],
            'distances': [[0.38]]
        }

        # Short query "Hi bot" -> Threshold 0.35 -> Reject 0.38
        results = self.service._search_general("Hi bot", user_id=1, bot_id=1, limit=5)
        self.assertEqual(len(results), 0)

    def test_long_query_standard_threshold(self):
        """Test that long queries use standard threshold (0.40)."""
        # Distance 0.38: Acceptable for long query
        self.service.collection.query.return_value = {
            'documents': [['Maybe Relevant']],
            'metadatas': [[{'source': 'Doc C', 'source_id': '3'}]],
            'distances': [[0.38]]
        }

        # Long query -> Threshold 0.40 -> Accept 0.38
        long_query = "This is a significantly longer query about complex topics in physics and science."
        results = self.service._search_general(long_query, user_id=1, bot_id=1, limit=5)
        self.assertEqual(len(results), 1)
