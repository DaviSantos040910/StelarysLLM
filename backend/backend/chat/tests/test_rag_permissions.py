from django.test import TestCase
from django.contrib.auth import get_user_model
from unittest.mock import MagicMock, patch
from chat.vector_service import vector_service

User = get_user_model()

class RAGPermissionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testrag")
        self.bot_id = 99
        self.space_id = 55
        self.other_space_id = 66

        # Reset mock collection for each test
        self.mock_collection = MagicMock()
        vector_service.collection = self.mock_collection
        # Mock embedding return
        vector_service._get_embedding = MagicMock(return_value=[0.1] * 3072)
        # Mock get_available_documents to avoid empty list causing early return
        # We need it to return at least one document so search proceeds
        # Or we can just mock it returning empty list?
        # If get_available_documents returns empty, search_context returns empty.
        # But we want to test the query construction.
        # Wait, if get_available_documents is empty, does it skip query?
        # Yes: if not available_docs ... return [], []

        # So we MUST mock get_available_documents OR let it run against the mock collection.
        # get_available_documents calls collection.get().
        # Let's mock collection.get() to return something.
        self.mock_collection.get.return_value = {
            'metadatas': [{'source': 'doc1.pdf', 'timestamp': '2025-01-01'}]
        }

    def test_search_context_filtering(self):
        """
        Verify that search_context builds the correct OR query for documents.
        """

        # Simulate a search call
        vector_service.search_context(
            query_text="test query",
            user_id=self.user.id,
            bot_id=self.bot_id,
            study_space_ids=[self.space_id],
            limit=5
        )

        # We expect at least 2 queries: one for docs, one for memory.
        # We need to find the one for 'type': 'document'

        doc_query_args = None

        for call in self.mock_collection.query.call_args_list:
            kwargs = call[1]
            where = kwargs.get('where', {})
            and_conds = where.get('$and', [])

            # check if this is the document query
            if {'type': 'document'} in and_conds:
                doc_query_args = kwargs
                break

        self.assertIsNotNone(doc_query_args, "Document query was not executed")

        where_clause = doc_query_args['where']
        and_conditions = where_clause['$and']

        # Verify user_id
        self.assertIn({'user_id': str(self.user.id)}, and_conditions)

        # Verify OR conditions
        # Depending on implementation, $or might be inside the list directly as a dict with key '$or'
        or_clause = next((item for item in and_conditions if '$or' in item), None)
        self.assertIsNotNone(or_clause, "OR clause not found in document query")

        or_list = or_clause['$or']

        # Must contain bot_id and study_space_id
        self.assertIn({'bot_id': str(self.bot_id)}, or_list)
        self.assertIn({'study_space_id': str(self.space_id)}, or_list)

        # Must NOT contain bot_id=0
        self.assertNotIn({'bot_id': '0'}, or_list)

        # Must NOT contain other spaces
        self.assertNotIn({'study_space_id': str(self.other_space_id)}, or_list)

    def test_search_context_private_only(self):
        """
        Verify search when no study spaces are linked.
        Should only search bot_id=99.
        """
        vector_service.search_context(
            query_text="test query",
            user_id=self.user.id,
            bot_id=self.bot_id,
            study_space_ids=[], # Empty
            limit=5
        )

        doc_query_args = None
        for call in self.mock_collection.query.call_args_list:
            kwargs = call[1]
            where = kwargs.get('where', {})
            and_conds = where.get('$and', [])
            if {'type': 'document'} in and_conds:
                doc_query_args = kwargs
                break

        self.assertIsNotNone(doc_query_args, "Document query was not executed")

        where_clause = doc_query_args['where']
        and_conditions = where_clause['$and']

        or_clause = next((item for item in and_conditions if '$or' in item), None)
        or_list = or_clause['$or']

        # Should only have bot_id
        self.assertEqual(len(or_list), 1)
        self.assertIn({'bot_id': str(self.bot_id)}, or_list)
        self.assertNotIn({'bot_id': '0'}, or_list)
