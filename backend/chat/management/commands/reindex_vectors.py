from django.core.management.base import BaseCommand
from studio.models import KnowledgeSource
from studio.services.knowledge_ingestion_service import KnowledgeIngestionService
from chat.vector_service import vector_service
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Reindexes all KnowledgeSources into the new vector collection using unified pipeline.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting reindex...'))

        sources = KnowledgeSource.objects.prefetch_related('study_spaces', 'chats__bot').all()
        count = sources.count()
        processed = 0
        errors = 0

        # Optional: Reset collection? 
        # vector_service.collection.delete() # Dangerous if not intended
        # Better: We delete per source to be safe.

        for source in sources:
            try:
                # 1. Clear old vectors for this source
                try:
                    # Delete where source_id matches. 
                    # Note: add_document_chunks uses str(source.id).
                    vector_service.collection.delete(where={"source_id": str(source.id)})
                    # self.stdout.write(f"Cleared vectors for {source.id}")
                except Exception as e:
                    pass

                indexed_any = False
                
                # 2. Index for linked Study Spaces
                for space in source.study_spaces.all():
                    success = KnowledgeIngestionService.ingest_source(
                        source,
                        study_space_id=space.id,
                        bot_id=None
                    )
                    if success: indexed_any = True

                # 3. Index for linked Chats (Private Tutor Context)
                # Note: 'chats' is related_name from Chat model
                for chat in source.chats.all():
                    if chat.bot:
                        success = KnowledgeIngestionService.ingest_source(
                            source,
                            bot_id=chat.bot.id,
                            study_space_id=None
                        )
                        if success: indexed_any = True
                
                # 4. Fallback: Global Library (User Level)
                # If not linked to anything specific, or just to ensure it's in the library scope?
                # Usually items in Library should be accessible by User's bots (bot_id=0).
                # If I only index specific spaces, then 'General' search might miss it.
                # Let's ALWAYS index as Global Library (bot_id=0) IF it's not private to a chat?
                # If it's in a Study Space, it's shared.
                # If it's in a Chat, it's private.
                # If it's just in Library, it's global.
                
                # Strategy: 
                # If it has Study Spaces -> It's in those spaces.
                # If it has Chats -> It's in those chats.
                # If NONE -> It's User Global.
                
                if not indexed_any:
                    success = KnowledgeIngestionService.ingest_source(
                        source,
                        bot_id=0,
                        study_space_id=None
                    )
                    if success: indexed_any = True

                if indexed_any:
                    processed += 1
                else:
                    self.stdout.write(self.style.WARNING(f"Failed to ingest {source.title} (No text extracted?)"))
                    errors += 1

                if processed % 10 == 0:
                    self.stdout.write(f"Processed {processed}/{count}...")

            except Exception as e:
                logger.error(f"Error reindexing {source.id}: {e}")
                self.stdout.write(self.style.ERROR(f"Error {source.id}: {e}"))
                errors += 1

        self.stdout.write(self.style.SUCCESS(f'Reindex complete. Processed: {processed}, Errors: {errors}'))
