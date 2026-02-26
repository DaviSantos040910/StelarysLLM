from django.test import TestCase
from unittest.mock import MagicMock
from chat.vector_service import VectorService

class VectorSafeWhereTest(TestCase):
    def setUp(self):
        # Patch settings to ensure consistent backend selection if needed,
        # but here we just mock self.backend directly after init
        self.service = VectorService()
        self.service.backend = MagicMock()
        self.service.genai_client = MagicMock()
        # Mock embedding return
        self.service._get_embedding = MagicMock(return_value=[0.1]*768)

    def test_safe_and_single_condition(self):
        """Test _safe_and with a single condition returns the condition dict directly."""
        conditions = [{"key": "value"}]
        result = self.service._safe_and(conditions)
        self.assertEqual(result, {"key": "value"})

    def test_safe_and_multiple_conditions(self):
        """Test _safe_and with multiple conditions returns $and clause."""
        conditions = [{"key1": "val1"}, {"key2": "val2"}]
        result = self.service._safe_and(conditions)
        self.assertEqual(result, {"$and": conditions})

    def test_safe_or_single_condition(self):
        """Test _safe_or with a single condition returns the condition dict directly."""
        conditions = [{"key": "value"}]
        result = self.service._safe_or(conditions)
        self.assertEqual(result, {"key": "value"})

    def test_get_available_documents_single_scope(self):
        """
        Verify get_available_documents constructs a safe where clause
        even when scopes result in a single condition.
        """
        # Mock backend.get_documents
        self.service.backend.get_documents.return_value = {'metadatas': []}

        self.service.get_available_documents(user_id=1, bot_id=0)

        # Check call args on backend
        call_args = self.service.backend.get_documents.call_args
        # backend.get_documents(where=...)
        where_clause = call_args[1]['where']

        # Expecting $and with 3 elements, NO nested single $or
        self.assertIn("$and", where_clause)
        self.assertEqual(len(where_clause["$and"]), 3)

        # Verify no "$or" with single element inside the $and list
        for condition in where_clause["$and"]:
            if "$or" in condition:
                self.assertGreaterEqual(len(condition["$or"]), 2)

    def test_get_available_documents_complex_scope(self):
        """
        Verify get_available_documents constructs a valid $or when needed.
        """
        self.service.backend.get_documents.return_value = {'metadatas': []}

        self.service.get_available_documents(user_id=1, bot_id=8)

        call_args = self.service.backend.get_documents.call_args
        where_clause = call_args[1]['where']

        self.assertIn("$and", where_clause)
        # Find the scope condition
        scope_cond = next((c for c in where_clause["$and"] if "$or" in c), None)
        self.assertIsNotNone(scope_cond)
        self.assertEqual(len(scope_cond["$or"]), 2)
