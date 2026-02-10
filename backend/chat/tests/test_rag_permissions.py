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
        
        # Mock query response
        self.mock_collection.query.return_value = {
            'documents': [['chunk1']],
            'metadatas': [[{'source': 'doc1', 'source_id': '100'}]],
            'distances': [[0.1]]
        }
        
        # Mock get_available_documents to return something so search proceeds
        self.mock_collection.get.return_value = {
            'metadatas': [
                {'source': 'doc1.pdf', 'source_id': '100', 'timestamp': '2025-01-01'},
                {'source': 'doc2.pdf', 'source_id': '101', 'timestamp': '2025-01-01'}
            ]
        }

    def test_search_context_filtering(self):
        """
        Verify that search_context builds the correct OR query for documents.
        """
        vector_service.search_context(
            query_text="test query",
            user_id=self.user.id,
            bot_id=self.bot_id,
            study_space_ids=[self.space_id],
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
        self.assertIsNotNone(or_clause)
        
        or_list = or_clause['$or']
        self.assertIn({'bot_id': str(self.bot_id)}, or_list)
        self.assertIn({'study_space_id': str(self.space_id)}, or_list)

    def test_search_context_with_allowed_source_ids(self):
        """
        Verify filtering by explicit source IDs.
        """
        allowed_ids = ['100', '102']
        vector_service.search_context(
            query_text="test query",
            user_id=self.user.id,
            bot_id=self.bot_id,
            study_space_ids=[self.space_id],
            limit=5,
            allowed_source_ids=allowed_ids
        )

        doc_query_args = None
        for call in self.mock_collection.query.call_args_list:
            kwargs = call[1]
            where = kwargs.get('where', {})
            and_conds = where.get('$and', [])
            if {'type': 'document'} in and_conds:
                doc_query_args = kwargs
                break
        
        self.assertIsNotNone(doc_query_args)
        where_clause = doc_query_args['where']
        and_conditions = where_clause['$and']

        # Check for source_id IN allowed_ids condition
        # Expected: {'source_id': {'$in': ['100', '102']}}
        id_filter = next((item for item in and_conditions if 'source_id' in item), None)
        self.assertIsNotNone(id_filter, "Source ID filter missing")
        self.assertEqual(id_filter['source_id'], {'$in': allowed_ids})
