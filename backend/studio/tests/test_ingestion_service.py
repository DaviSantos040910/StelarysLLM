from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import MagicMock, patch
from studio.models import KnowledgeSource
from studio.services.knowledge_ingestion_service import KnowledgeIngestionService

User = get_user_model()

class IngestionServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testingest")
        self.file = SimpleUploadedFile("test.txt", b"Test content")

    @patch('chat.file_processor.FileProcessor.extract_text')
    @patch('chat.file_processor.FileProcessor.chunk_text')
    @patch('chat.vector_service.vector_service.add_document_chunks')
    def test_ingest_source_success(self, mock_add, mock_chunk, mock_extract):
        """Test successful ingestion of a file source."""
        # Setup mocks
        mock_extract.return_value = "Extracted text content"
        mock_chunk.return_value = ["chunk1", "chunk2"]
        
        # Create source
        source = KnowledgeSource.objects.create(
            user=self.user,
            title="Test Source",
            source_type=KnowledgeSource.SourceType.FILE,
            file=self.file
        )
        
        # Run Ingestion
        result = KnowledgeIngestionService.ingest_source(source, bot_id=10, study_space_id=20)
        
        # Assertions
        self.assertTrue(result)
        
        # Verify extraction
        mock_extract.assert_called_once()
        source.refresh_from_db()
        self.assertEqual(source.extracted_text, "Extracted text content")
        
        # Verify indexing
        mock_chunk.assert_called_with("Extracted text content")
        mock_add.assert_called_with(
            user_id=self.user.id,
            chunks=["chunk1", "chunk2"],
            source_name="Test Source",
            source_id=str(source.id),
            bot_id=10,
            study_space_id=20
        )

    @patch('chat.services.image_description_service.image_description_service.describe_image')
    @patch('chat.vector_service.vector_service.add_document_chunks')
    def test_ingest_image_source(self, mock_add, mock_describe):
        """Test successful ingestion of an image source."""
        mock_describe.return_value = "Image description"
        # We need chunking too, assuming FileProcessor handles strings
        with patch('chat.file_processor.FileProcessor.chunk_text', return_value=['chunk']) as mock_chunk:
            source = KnowledgeSource.objects.create(
                user=self.user,
                title="Test Image",
                source_type=KnowledgeSource.SourceType.IMAGE,
                file=SimpleUploadedFile("img.jpg", b"fakeimg", content_type="image/jpeg")
            )
            
            result = KnowledgeIngestionService.ingest_source(source)
            
            self.assertTrue(result)
            mock_describe.assert_called_once()
            mock_add.assert_called()

    @patch('chat.services.image_description_service.image_description_service.describe_image')
    @patch('chat.file_processor.FileProcessor.extract_text')
    @patch('chat.vector_service.vector_service.add_document_chunks')
    def test_ingest_file_as_image_fallback(self, mock_add, mock_extract, mock_describe):
        """
        Test that a source marked as FILE but with image mimetype is routed to image description service.
        """
        mock_describe.return_value = "Robust image description"
        
        with patch('chat.file_processor.FileProcessor.chunk_text', return_value=['chunk']) as mock_chunk:
            # Create source as FILE but with .jpg extension/content_type
            source = KnowledgeSource.objects.create(
                user=self.user,
                title="Mislabelled Image",
                source_type=KnowledgeSource.SourceType.FILE, 
                file=SimpleUploadedFile("photo.jpg", b"fakeimg", content_type="image/jpeg")
            )
            
            result = KnowledgeIngestionService.ingest_source(source)
            
            self.assertTrue(result)
            # Should call describe_image, NOT extract_text
            mock_describe.assert_called_once()
            mock_extract.assert_not_called()
            
            source.refresh_from_db()
            self.assertEqual(source.extracted_text, "Robust image description")
