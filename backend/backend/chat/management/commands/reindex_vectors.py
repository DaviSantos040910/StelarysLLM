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

        sources = KnowledgeSource.objects.prefetch_related('study_spaces', 'chats__bot').all()
        count = sources.count()
        processed = 0
        errors = 0

        # Optional: Reset collection?
        # vector_service.collection.delete() # Dangerous if not intended

        for source in sources:
            try:
                # Clean up existing vectors for this source to avoid duplicates
                try:
                    vector_service.collection.delete(where={"source_id": str(source.id)})
                    self.stdout.write(f"Cleared old vectors for {source.id}")
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Could not clear vectors for {source.id}: {e}"))

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
                        indexed_any = False

                        # 1. Index for linked Study Spaces
                        for space in source.study_spaces.all():
                            vector_service.add_document_chunks(
                                user_id=source.user.id,
                                chunks=chunks,
                                source_name=source.title,
                                source_id=source.id,
                                bot_id=None,
                                study_space_id=space.id
                            )
                            indexed_any = True

                        # 2. Index for linked Chats (Private Tutor Context)
                        for chat in source.chats.all():
                            if chat.bot:
                                vector_service.add_document_chunks(
                                    user_id=source.user.id,
                                    chunks=chunks,
                                    source_name=source.title,
                                    source_id=source.id,
                                    bot_id=chat.bot.id,
                                    study_space_id=None
                                )
                                indexed_any = True

                        # 3. Fallback: Global Library (if not linked to anything specific)
                        if not indexed_any:
                             vector_service.add_document_chunks(
                                user_id=source.user.id,
                                chunks=chunks,
                                source_name=source.title,
                                source_id=source.id,
                                bot_id=0,
                                study_space_id=None
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
