from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class VectorStoreBackend(ABC):
    @abstractmethod
    def add_documents(self, documents: List[str], embeddings: List[List[float]], metadatas: List[Dict], ids: List[str]):
        pass

    @abstractmethod
    def search(self, query_embedding: List[float], limit: int, where: Dict = None) -> Dict:
        """
        Must return dict with keys: 'documents', 'metadatas', 'distances' (optional)
        """
        pass

    @abstractmethod
    def get_documents(self, where: Dict) -> Dict:
        pass

    @abstractmethod
    def update_documents(self, ids: List[str], metadatas: List[Dict]):
        pass

    @abstractmethod
    def delete_documents(self, where: Dict):
        pass
