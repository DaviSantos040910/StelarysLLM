import logging
from django.conf import settings
from .base import VectorStoreBackend
from pgvector.django import L2Distance, CosineDistance
from django.db import transaction
from chat.models import VectorChunk

logger = logging.getLogger(__name__)

class PGVectorBackend(VectorStoreBackend):
    def __init__(self):
        # Assumes VectorChunk model exists and pgvector extension is enabled in DB
        logger.info("PGVectorBackend initialized (lazy)")

    def add_documents(self, documents, embeddings, metadatas, ids):
        # Bulk create VectorChunk objects
        objs = []
        for doc, emb, meta, uid in zip(documents, embeddings, metadatas, ids):
            objs.append(VectorChunk(
                id=uid,
                content=doc,
                embedding=emb,
                metadata=meta,
                # Extract specific fields from metadata for easier querying if needed
                user_id=meta.get('user_id'),
                bot_id=meta.get('bot_id'),
                type=meta.get('type')
            ))

        VectorChunk.objects.bulk_create(objs)

    def search(self, query_embedding, limit, where=None):
        # Convert 'where' dict to Django Q objects or filter kwargs
        # This is complex because Chroma 'where' syntax is specific ($and, $or)
        # We need a converter. For now, implementing basic support.

        qs = VectorChunk.objects.all()

        if where:
            # Simplistic filter implementation
            filters = self._parse_chroma_where(where)
            if filters:
                qs = qs.filter(**filters)

        # KNN Search
        qs = qs.order_by(CosineDistance('embedding', query_embedding))[:limit]

        # Format to match Chroma output structure
        documents = []
        metadatas = []
        distances = []
        ids = []

        for obj in qs:
            documents.append(obj.content)
            metadatas.append(obj.metadata)
            ids.append(str(obj.id))
            # Distance might need extra annotation calculation if needed,
            # or we assume order is enough. Chroma returns distances.
            # We can annotate distance.

        return {
            'documents': [documents], # Chroma returns list of lists
            'metadatas': [metadatas],
            'ids': [ids],
            'distances': [[]] # Placeholder
        }

    def get_documents(self, where):
        qs = VectorChunk.objects.all()
        if where:
            filters = self._parse_chroma_where(where)
            if filters:
                qs = qs.filter(**filters)

        # Format return
        ids = []
        metadatas = []
        for obj in qs:
            ids.append(str(obj.id))
            metadatas.append(obj.metadata)

        return {'ids': ids, 'metadatas': metadatas}

    def update_documents(self, ids, metadatas):
        with transaction.atomic():
            for uid, meta in zip(ids, metadatas):
                VectorChunk.objects.filter(id=uid).update(metadata=meta)

    def delete_documents(self, where):
        qs = VectorChunk.objects.all()
        if where:
            filters = self._parse_chroma_where(where)
            if filters:
                qs.filter(**filters).delete()

    def _parse_chroma_where(self, where):
        """
        Basic parser to convert Chroma dict filters to Django kwargs.
        Supports exact matches on metadata fields.
        """
        # Note: VectorChunk.metadata is a JSONField.
        # Queries on JSONField in Django: metadata__field=value
        filters = {}

        # Handle $and list
        if "$and" in where:
            for cond in where["$and"]:
                filters.update(self._parse_chroma_where(cond))
            return filters

        # Handle simple key-value
        for k, v in where.items():
            if k == "$or": continue # Not supported simply yet

            # If standard field
            if k in ['user_id', 'bot_id', 'type']:
                filters[k] = v
            else:
                # Assume metadata field
                filters[f"metadata__{k}"] = v

        return filters
