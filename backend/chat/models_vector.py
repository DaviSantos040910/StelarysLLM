from django.db import models
from django.conf import settings
from pgvector.django import VectorField

class VectorChunk(models.Model):
    """
    Model for storing text chunks and their embeddings using PGVector.
    Replaces ChromaDB in production.
    """
    id = models.UUIDField(primary_key=True, editable=False) # We generate UUIDs in code
    content = models.TextField()
    embedding = VectorField(dimensions=3072) # Gemini embedding dimension
    metadata = models.JSONField(default=dict)

    # Indexed fields for faster filtering
    user_id = models.CharField(max_length=255, db_index=True)
    bot_id = models.CharField(max_length=255, db_index=True, blank=True)
    type = models.CharField(max_length=50, db_index=True) # 'document', 'memory'

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            # Add specific indexes if needed, e.g. for user_id + type
        ]
