from django.test import TestCase
from unittest.mock import MagicMock
from chat.vector_service import VectorService

class VectorSafeWhereTest(TestCase):
    def setUp(self):
        self.service = VectorService()
        # Mock dependencies to avoid init errors or API calls
        self.service.client = MagicMock()
        self.service.collection = MagicMock()
        self.service.genai_client = MagicMock()
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
        # Mock collection.get
        self.service.collection.get.return_value = {'metadatas': []}
        
        # Case: bot_id=0, no study spaces. 
        # _build_or_filter logic: bot_id=0 -> OR list has ["bot_id": "0"]. 
        # Wait, my code in get_available_documents:
        # or_list = [{"bot_id": str(bot_id)}]
        # if str(bot_id) != "0": or_list.append({"bot_id": "0"})
        
        # If bot_id=0: or_list = [{"bot_id": "0"}] (Length 1)
        # _safe_or returns {"bot_id": "0"}
        # and_list = [{"user_id":...}, {"type":...}, {"bot_id": "0"}]
        # _safe_and returns {"$and": [...]} (Length 3) -> Safe.
        
        self.service.get_available_documents(user_id=1, bot_id=0)
        
        # Check call args
        call_args = self.service.collection.get.call_args
        where_clause = call_args[1]['where']
        
        # Expecting $and with 3 elements, NO nested single $or
        self.assertIn("$and", where_clause)
        self.assertEqual(len(where_clause["$and"]), 3)
        
        # Verify no "$or" with single element inside the $and list
        for condition in where_clause["$and"]:
            if "$or" in condition:
                self.assertGreaterEqual(len(condition["$or"]), 2)
            # We expect strict flat structure here if safe_or worked for single item
            # actually, if safe_or returned flat, it is appended to and_list.
            # So {"bot_id": "0"} should be directly in and_list.
            
    def test_get_available_documents_complex_scope(self):
        """
        Verify get_available_documents constructs a valid $or when needed.
        """
        self.service.collection.get.return_value = {'metadatas': []}
        
        # Case: bot_id=8 (not 0), no study spaces.
        # or_list = [{"bot_id": "8"}, {"bot_id": "0"}] -> Length 2.
        # _safe_or returns {"$or": [...]}
        
        self.service.get_available_documents(user_id=1, bot_id=8)
        
        call_args = self.service.collection.get.call_args
        where_clause = call_args[1]['where']
        
        self.assertIn("$and", where_clause)
        # Find the scope condition
        scope_cond = next((c for c in where_clause["$and"] if "$or" in c), None)
        self.assertIsNotNone(scope_cond)
        self.assertEqual(len(scope_cond["$or"]), 2)

