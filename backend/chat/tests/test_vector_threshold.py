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
        # Mock genai client to prevent init errors
        self.service.genai_client = MagicMock()

    def test_search_general_good_match(self):
        """Test a strong match that should be returned (Distance 0.2 < 0.60)."""
        # Setup mock results
        self.service.collection.query.return_value = {
            'documents': [['Content A']],
            'metadatas': [[{'source': 'Doc A', 'source_id': '1'}]],
            'distances': [[0.2]]
        }

        # Need to provide user_id and bot_id. allowed_source_ids=None to search all.
        results = self.service._search_general("QUERY: What is physics?", user_id=1, bot_id=1, limit=5, allowed_source_ids=None)
        
        # Note: _search_general returns candidates list of dicts with 'score' key
        # Depending on implementation, it might return formatted candidates.
        # Looking at code: it returns self._format_candidates(final_selection) which has 'score'

        # However, _search_general logic:
        # It calls collection.query
        # Then filters by SIMILARITY_THRESHOLD = 0.60

        # If mock returns 0.2, it should pass.
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['content'], 'Content A')
        self.assertEqual(results[0]['score'], 0.2)

    def test_search_general_bad_match_filtered(self):
        """Test that matches worse than 0.60 are filtered out."""
        # Setup mock results: Distance 0.7 (Worse than 0.60 threshold)
        self.service.collection.query.return_value = {
            'documents': [['Irrelevant Content']],
            'metadatas': [[{'source': 'Doc B', 'source_id': '2'}]],
            'distances': [[0.7]]
        }

        results = self.service._search_general("QUERY: What is physics?", user_id=1, bot_id=1, limit=5, allowed_source_ids=None)
        
        # Should be filtered out
        self.assertEqual(len(results), 0)

    def test_search_general_boundary_match(self):
        """Test a match exactly at or slightly below the relaxed threshold (0.59)."""
        # Distance 0.59: Should be accepted by VectorService (0.60 limit)
        # (EvidenceGate might reject it later, but VectorService should return it)
        self.service.collection.query.return_value = {
            'documents': [['Marginal Content']],
            'metadatas': [[{'source': 'Doc C', 'source_id': '3'}]],
            'distances': [[0.59]]
        }

        results = self.service._search_general("Query", user_id=1, bot_id=1, limit=5, allowed_source_ids=None)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['score'], 0.59)
