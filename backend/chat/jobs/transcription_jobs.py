import logging
from django_rq import job
from rq import Retry
from studio.models import KnowledgeSource
from chat.services.youtube_service import YouTubeService
from chat.vector_service import vector_service
from chat.file_processor import FileProcessor

logger = logging.getLogger(__name__)

@job('default', timeout=900, result_ttl=86400, retry=Retry(max=3))
def process_youtube_source_job(source_id):
    """
    Background job to process YouTube sources.
    1. Fetch transcript (with limits).
    2. Update KnowledgeSource.
    3. Index content.
    """
    try:
        source = KnowledgeSource.objects.get(id=source_id)
        if not source.url:
            logger.error(f"[Job] Source {source_id} has no URL.")
            return

        logger.info(f"[Job] Processing YouTube source: {source.title} ({source.url})")

        # 1. Fetch Transcript
        transcript = YouTubeService.get_transcript(source.url)

        # 2. Update Source
        source.extracted_text = transcript
        source.save(update_fields=['extracted_text'])

        # 3. Index Content
        if transcript and not transcript.startswith("Erro"):
            chunks = FileProcessor.chunk_text(transcript)
            if chunks:
                vector_service.add_document_chunks(
                    user_id=source.user.id,
                    chunks=chunks,
                    source_name=source.title,
                    source_id=str(source.id),
                    bot_id=None, # Global or handle via StudySpace relation?
                    # Note: IngestionService usually handles linking.
                    # If this job is triggered by IngestService, the linking is already done via DB relations?
                    # vector_service needs bot_id or study_space_id to associate embedding.
                    # BUT KnowledgeSource model has many-to-many to StudySpace.
                    # We need to index for ALL associated spaces? Or assumes standard "Library" indexing.
                    # In KnowledgeIngestionService, it passes bot_id/study_space_id explicitly.
                    # We might need to pass them to this job.
                    # HOWEVER, vector_service.add_document_chunks usually adds to a specific collection.
                    # Let's check KnowledgeIngestionService.ingest_source again.
                    # It accepts bot_id/study_space_id arguments.
                    # If we move to RQ, we must pass these args to the job.
                )
                logger.info(f"[Job] Successfully indexed source {source_id}")
        else:
            logger.warning(f"[Job] Failed to get valid transcript for {source_id}: {transcript}")

    except Exception as e:
        logger.error(f"[Job] Failed to process source {source_id}: {e}", exc_info=True)
        raise e

# Updated job signature to accept context params
@job('default', timeout=900, result_ttl=86400, retry=Retry(max=3))
def process_youtube_source_context_job(source_id, bot_id=None, study_space_id=None):
    try:
        source = KnowledgeSource.objects.get(id=source_id)
        logger.info(f"[Job] Processing YouTube source {source_id} for Bot={bot_id}, Space={study_space_id}")

        transcript = YouTubeService.get_transcript(source.url)

        source.extracted_text = transcript
        source.save(update_fields=['extracted_text'])

        if transcript and not transcript.startswith("Erro"):
            chunks = FileProcessor.chunk_text(transcript)
            if chunks:
                vector_service.add_document_chunks(
                    user_id=source.user.id,
                    chunks=chunks,
                    source_name=source.title,
                    source_id=str(source.id),
                    bot_id=bot_id,
                    study_space_id=study_space_id
                )
    except Exception as e:
        logger.error(f"[Job] Failed context job for {source_id}: {e}", exc_info=True)
        raise e
