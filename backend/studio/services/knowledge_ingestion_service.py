import logging
import mimetypes
import django_rq
from typing import Optional
from studio.models import KnowledgeSource
from chat.file_processor import FileProcessor
from chat.services.content_extractor import ContentExtractor
from chat.services.image_description_service import image_description_service
from chat.vector_service import vector_service
from chat.jobs.transcription_jobs import process_youtube_source_context_job

logger = logging.getLogger(__name__)

class KnowledgeIngestionService:
    """
    Central service for extracting content from KnowledgeSources and indexing them into the Vector DB.
    """

    @staticmethod
    def ingest_source(
        source: KnowledgeSource, 
        bot_id: Optional[int] = None, 
        study_space_id: Optional[int] = None
    ) -> bool:
        """
        Extracts text from the source and indexes it.
        Returns True if successful, False otherwise.
        """
        try:
            # 1. Extract Text (if not already present)
            if not source.extracted_text:
                extracted_text = ""
                
                if source.source_type == KnowledgeSource.SourceType.FILE and source.file:
                    # Robustness: Check if FILE is actually an image
                    mime_type, _ = mimetypes.guess_type(source.file.name)
                    if mime_type and mime_type.startswith('image/'):
                        extracted_text = image_description_service.describe_image(source.file)
                        # Optional: correct the source type for future reference
                        # source.source_type = KnowledgeSource.SourceType.IMAGE
                    else:
                        extracted_text = FileProcessor.extract_text(source.file.path)
                
                elif source.source_type == KnowledgeSource.SourceType.IMAGE and source.file:
                    extracted_text = image_description_service.describe_image(source.file)
                
                elif source.source_type == KnowledgeSource.SourceType.YOUTUBE and source.url:
                    # Offload YouTube to RQ
                    django_rq.enqueue(process_youtube_source_context_job, source.id, bot_id, study_space_id)
                    logger.info(f"Enqueued YouTube processing for source {source.id}")
                    return True # Return True to indicate accepted (async)

                elif source.source_type == KnowledgeSource.SourceType.URL and source.url:
                    extracted_text = ContentExtractor.extract_from_url(source.url)

                if extracted_text:
                    source.extracted_text = extracted_text
                    source.save(update_fields=['extracted_text'])
                else:
                    logger.warning(f"No text extracted for source {source.id} ({source.title})")
                    return False

            # 2. Chunk and Index
            text = source.extracted_text
            if text:
                chunks = FileProcessor.chunk_text(text)
                if chunks:
                    vector_service.add_document_chunks(
                        user_id=source.user.id,
                        chunks=chunks,
                        source_name=source.title,
                        source_id=str(source.id),
                        bot_id=bot_id,
                        study_space_id=study_space_id
                    )
                    return True
            
            return False

        except Exception as e:
            logger.error(f"Error processing KnowledgeSource {source.id}: {e}", exc_info=True)
            return False
