# chat/vector_store/chroma.py
"""
Backend para ChromaDB.
"""
from django.conf import settings
import os
import logging
from .base import VectorStoreBackend

logger = logging.getLogger(__name__)

class ChromaBackend(VectorStoreBackend):
    def __init__(self):
        try:
            import chromadb
        except ImportError:
            raise ImportError("chromadb is not installed. Please install it to use ChromaBackend.")

        db_path = str(settings.CHROMA_DB_PATH)
        os.makedirs(db_path, exist_ok=True)
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(
            name="chat_memory_3072",
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"ChromaBackend initialized at {db_path}")

    def add_documents(self, documents, embeddings, metadatas, ids):
        self.collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    def search(self, query_embedding, limit, where=None):
        return self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where
        )

    def get_documents(self, where):
        return self.collection.get(where=where, include=["metadatas"])

    def update_documents(self, ids, metadatas):
        self.collection.update(ids=ids, metadatas=metadatas)

    def delete_documents(self, where):
        self.collection.delete(where=where)
