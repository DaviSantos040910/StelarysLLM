from django.test import TestCase
from django.contrib.auth import get_user_model
from studio.models import KnowledgeSource
from chat.vector_service import vector_service
from unittest.mock import MagicMock, patch

User = get_user_model()

class ReindexTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testreindex")
        self.source = KnowledgeSource.objects.create(
            user=self.user,
            title="Test Source",
            extracted_text="This is a test document for reindexing."
        )

    @patch('chat.vector_service.vector_service.client')
    def test_reindex_logic(self, mock_client):
        """
        Simula a lógica de reindexação e verifica se a collection é chamada com os dados corretos.
        """
        # Mock da collection
        mock_collection = MagicMock()
        vector_service.collection = mock_collection

        # Mock do embedding para retornar 3072 floats
        vector_service._get_embedding = MagicMock(return_value=[0.1] * 3072)

        # Executa a lógica de adição (simulando o comando)
        chunks = ["This is a test document for reindexing."]
        vector_service.add_document_chunks(
            user_id=self.user.id,
            chunks=chunks,
            source_name=self.source.title,
            source_id=self.source.id,
            bot_id=0,
            study_space_id=None
        )

        # Verifica se add foi chamado
        mock_collection.add.assert_called_once()

        # Verifica argumentos
        args, kwargs = mock_collection.add.call_args
        embeddings = kwargs['embeddings']
        self.assertEqual(len(embeddings[0]), 3072)
        self.assertEqual(kwargs['documents'][0], chunks[0])
