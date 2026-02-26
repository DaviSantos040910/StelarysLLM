import logging
import mimetypes
from typing import Optional
from studio.models import KnowledgeSource
from chat.file_processor import FileProcessor
from chat.services.content_extractor import ContentExtractor
from chat.services.image_description_service import image_description_service
from chat.vector_service import vector_service
from chat.services.ingestion_queue_provider import enqueue_youtube_ingestion
from studio.exceptions import DocumentInvalidException

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
                        extracted_text = FileProcessor.extract_text(source.file)

                elif source.source_type == KnowledgeSource.SourceType.IMAGE and source.file:
                    extracted_text = image_description_service.describe_image(source.file)

                elif source.source_type == KnowledgeSource.SourceType.YOUTUBE and source.url:
                    # Offload YouTube to Queue (Cloud Tasks / Thread)
                    enqueue_youtube_ingestion(source.id, bot_id=bot_id, study_space_id=study_space_id)
                    logger.info(f"Enqueued YouTube processing for source {source.id}")
                    return True # Return True to indicate accepted (async)

                elif source.source_type == KnowledgeSource.SourceType.URL and source.url:
                    extracted_text = ContentExtractor.extract_from_url(source.url)

                # Validation for Scanned Documents (PDF/Images without text)
                # We enforce a minimum length for FILE types that are not images
                is_file = (source.source_type == KnowledgeSource.SourceType.FILE)
                # Check if it was treated as an image
                is_image_file = False
                if is_file and source.file:
                    mime_type, _ = mimetypes.guess_type(source.file.name)
                    if mime_type and mime_type.startswith('image/'):
                        is_image_file = True

                # Determine validity
                is_valid = False
                if extracted_text and len(extracted_text.strip()) >= 50:
                    is_valid = True
                elif is_image_file and extracted_text and len(extracted_text.strip()) > 5:
                     # Relaxed limit for images (captions can be short)
                     is_valid = True

                if is_valid:
                    source.extracted_text = extracted_text
                    source.save(update_fields=['extracted_text'])
                else:
                    if is_file and not is_image_file:
                        # Mark invalid for auditing (optional, but transaction rollback prevents saving)
                        # We raise exception to notify user
                        raise DocumentInvalidException(
                            detail="Não foi possível ler esse documento. Parece ser um PDF escaneado (sem texto). Envie uma versão com texto ou outro arquivo.",
                            meta={"source_id": source.id}
                        )

                    logger.warning(f"No text extracted for source {source.id} ({source.title})")
                    return False

            # 2. Chunk and Index
            text = source.extracted_text
            if text:
                chunks = FileProcessor.chunk_text(text)
                if chunks:
                    # Determine owner_id
                    owner_id = None
                    if source.user:
                        owner_id = source.user.id
                    elif source.guest_session:
                        owner_id = str(source.guest_session.id)
                    else:
                        logger.error(f"Cannot ingest source {source.id}: No user or guest_session owner.")
                        return False

                    vector_service.add_document_chunks(
                        user_id=owner_id,
                        chunks=chunks,
                        source_name=source.title,
                        source_id=str(source.id),
                        bot_id=bot_id,
                        study_space_id=study_space_id,
                        source_type=source.source_type,
                        source_url=source.url
                    )
                    return True

            return False

        except DocumentInvalidException:
            raise
        except Exception as e:
            logger.error(f"Error processing KnowledgeSource {source.id}: {e}", exc_info=True)
            return False
