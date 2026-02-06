from django.core.management.base import BaseCommand
from studio.models import KnowledgeSource
from chat.file_processor import FileProcessor
from chat.vector_service import vector_service
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Reindexes all KnowledgeSources into the new vector collection (dim 3072).'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting reindex...'))

        sources = KnowledgeSource.objects.all()
        count = sources.count()
        processed = 0
        errors = 0

        for source in sources:
            try:
                # Use extracted text if available
                text = source.extracted_text

                # If not available but file exists, try to extract
                if not text and source.file:
                    self.stdout.write(f"Extracting text for {source.title}...")
                    try:
                        text = FileProcessor.extract_text(source.file.path)
                        if text:
                            source.extracted_text = text
                            source.save(update_fields=['extracted_text'])
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"Failed to extract {source.id}: {e}"))
                        errors += 1
                        continue

                if text:
                    chunks = FileProcessor.chunk_text(text)
                    if chunks:
                        # Indexing logic (assumes bot_id=0 for global user space or specific logic)
                        # We use 0 as a safe default for "User's Library" if not bound to specific bot yet,
                        # or we rely on the search logic to look up by user_id.
                        # Looking at views.py, it indexes with bot_id=0 for sources.
                        vector_service.add_document_chunks(
                            user_id=source.user.id,
                            bot_id=0,
                            chunks=chunks,
                            source_name=source.title
                        )
                        processed += 1
                        if processed % 10 == 0:
                            self.stdout.write(f"Processed {processed}/{count}...")
                else:
                    self.stdout.write(self.style.WARNING(f"Skipping {source.title} (no text)"))

            except Exception as e:
                logger.error(f"Error reindexing {source.id}: {e}")
                self.stdout.write(self.style.ERROR(f"Error {source.id}: {e}"))
                errors += 1

        self.stdout.write(self.style.SUCCESS(f'Reindex complete. Processed: {processed}, Errors: {errors}'))
