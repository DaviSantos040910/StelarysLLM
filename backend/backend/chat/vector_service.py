# chat/vector_service.py
"""
Serviço vetorial com suporte inteligente a múltiplos documentos.
"""

import chromadb
# Use google.genai instead of google.generativeai
from google import genai
from django.conf import settings
import logging
import uuid
from datetime import datetime
import os
import re
from typing import List, Dict, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class QueryType(Enum):
    """Tipos de query para determinar estratégia de busca."""
    REFERENCE = "reference"      # "o que é isso?", "esse documento"
    SPECIFIC = "specific"        # "no arquivo X.pdf", "segundo o documento Y"
    COMPARATIVE = "comparative"  # "compare os dois", "diferença entre os documentos"
    GENERAL = "general"          # Perguntas gerais que podem estar em qualquer doc


class VectorService:
    """
    Gerencia busca vetorial com suporte inteligente a múltiplos documentos.
    """

    def __init__(self):
        self.client: Optional[chromadb.PersistentClient] = None
        self.collection = None
        self._initialize()

    def _initialize(self) -> None:
        """Inicializa ChromaDB e API Gemini."""
        try:
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                logger.error("GEMINI_API_KEY não encontrada.")
                return

            # Using google.genai client initialization is slightly different.
            self.genai_client = genai.Client(api_key=api_key)

            db_path = str(settings.CHROMA_DB_PATH)
            os.makedirs(db_path, exist_ok=True)

            self.client = chromadb.PersistentClient(path=db_path)
            self.collection = self.client.get_or_create_collection(
                name="chat_memory",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"VectorService inicializado: {db_path}")

        except Exception as e:
            logger.critical(f"Falha ao inicializar VectorService: {e}")

    def _get_embedding(self, text: str, task_type: str = "retrieval_document") -> Optional[List[float]]:
        """Gera embedding usando Gemini."""
        if not text or len(text.strip()) < 3:
            return None

        try:
            response = self.genai_client.models.embed_content(
                model="text-embedding-004",
                contents=text[:8000],
            )

            if response.embeddings:
                return response.embeddings[0].values
            return None

        except Exception as e:
            logger.error(f"Erro ao gerar embedding: {e}")
            return None

    # =========================================================================
    # MÉTODOS DE ADIÇÃO
    # =========================================================================

    def add_memory(self, user_id: int, bot_id: int, text: str, role: str) -> None:
        """Adiciona memória de conversação."""
        if not self.collection or not text:
            return

        try:
            embedding = self._get_embedding(text)
            if not embedding:
                return

            self.collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[{
                    'user_id': str(user_id),
                    'bot_id': str(bot_id),
                    'role': role,
                    'timestamp': datetime.now().isoformat(),
                    'type': 'memory'
                }],
                ids=[str(uuid.uuid4())]
            )
        except Exception as e:
            logger.error(f"Erro ao salvar memória: {e}")

    def add_document_chunks(
        self,
        user_id: int,
        bot_id: int,
        chunks: List[str],
        source_name: str,
        message_id: Optional[int] = None
    ) -> None:
        """Adiciona chunks de documento com metadados completos."""
        if not self.collection or not chunks:
            return

        logger.info(f"Indexando {len(chunks)} chunks de '{source_name}'")

        docs, embeds, metas, ids = [], [], [], []
        timestamp = datetime.now().isoformat()

        for i, chunk in enumerate(chunks):
            embedding = self._get_embedding(chunk)
            if not embedding:
                continue

            docs.append(chunk)
            embeds.append(embedding)
            ids.append(str(uuid.uuid4()))
            metas.append({
                'user_id': str(user_id),
                'bot_id': str(bot_id),
                'type': 'document',
                'source': source_name,
                'source_lower': source_name.lower(),  # Para busca case-insensitive
                'chunk_index': i,
                'total_chunks': len(chunks),
                'timestamp': timestamp,
                'message_id': str(message_id) if message_id else ''
            })

        if docs:
            try:
                self.collection.add(
                    documents=docs, embeddings=embeds, metadatas=metas, ids=ids
                )
                logger.info(f"RAG: {len(docs)} chunks indexados de '{source_name}'")
            except Exception as e:
                logger.error(f"Erro ao indexar documento: {e}")

    # =========================================================================
    # MÉTODOS DE ANÁLISE DE QUERY
    # =========================================================================

    def classify_query(self, query: str, available_sources: List[str]) -> Tuple[QueryType, Optional[str]]:
        """
        Classifica o tipo de query e extrai documento específico se mencionado.

        Returns:
            Tuple: (QueryType, nome_do_documento_se_especificado)
        """
        query_lower = query.lower()

        # 1. Verifica se menciona documento específico pelo nome
        for source in available_sources:
            source_lower = source.lower()
            # Remove extensão para comparação mais flexível
            source_base = os.path.splitext(source_lower)[0]

            if source_lower in query_lower or source_base in query_lower:
                return QueryType.SPECIFIC, source

        # 2. Detecta queries comparativas
        comparative_patterns = [
            r'\b(compare|comparar|diferença|diferente|versus|vs\.?|entre os)\b',
            r'\b(os dois|ambos|os documentos|os arquivos)\b',
            r'\b(primeiro|segundo|terceiro)\s+(documento|arquivo)\b'
        ]
        if any(re.search(p, query_lower) for p in comparative_patterns):
            return QueryType.COMPARATIVE, None

        # 3. Detecta referências pronominais (documento mais recente)
        reference_patterns = [
            r'\b(isso|isto|esse|este|essa|esta)\b',
            r'\b(esse|este|o)\s+(documento|arquivo|pdf|texto)\b',
            r'\bresuma\s*(isso|isto|esse|este)?\b',
            r'\bexplique\s*(isso|isto|esse|este)?\b',
            r'\bo que (é|são|diz|fala)\s*(isso|isto|esse|este)?\b'
        ]
        if any(re.search(p, query_lower) for p in reference_patterns):
            return QueryType.REFERENCE, None

        # 4. Query geral - busca em todos os documentos
        return QueryType.GENERAL, None

    def get_available_documents(self, user_id: int, bot_id: int) -> List[Dict]:
        """
        Lista todos os documentos disponíveis para o usuário/bot.

        Returns:
            Lista de dicts com 'source' e 'timestamp', ordenados por recência.
        """
        if not self.collection:
            return []

        try:
            results = self.collection.get(
                where={
                    "$and": [
                        {"user_id": str(user_id)},
                        {"bot_id": {"$in": [str(bot_id), "0"]}},
                        {"type": "document"}
                    ]
                },
                include=["metadatas"]
            )

            if not results or not results['metadatas']:
                return []

            # Agrupa por source e pega o timestamp mais recente de cada
            docs_map = {}
            for meta in results['metadatas']:
                source = meta.get('source', '')
                timestamp = meta.get('timestamp', '')

                if source and (source not in docs_map or timestamp > docs_map[source]):
                    docs_map[source] = timestamp

            # Ordena por timestamp (mais recente primeiro)
            sorted_docs = sorted(
                [{'source': s, 'timestamp': t} for s, t in docs_map.items()],
                key=lambda x: x['timestamp'],
                reverse=True
            )

            return sorted_docs

        except Exception as e:
            logger.error(f"Erro ao listar documentos: {e}")
            return []

    # =========================================================================
    # MÉTODO PRINCIPAL DE BUSCA
    # =========================================================================

    def search_context(
        self,
        query_text: str,
        user_id: int,
        bot_id: int,
        limit: int = 6,
        recent_doc_source: Optional[str] = None,
        allowed_sources: Optional[List[str]] = None
    ) -> Tuple[List[str], List[str]]:
        """
        Busca inteligente com suporte a múltiplos documentos e filtro opcional.
        """
        if not self.collection:
            return [], []

        try:
            # 1. Lista documentos disponíveis
            available_docs = self.get_available_documents(user_id, bot_id)
            available_sources = [d['source'] for d in available_docs]

            # Aplica filtro de allowed_sources se fornecido
            if allowed_sources is not None:
                available_sources = [s for s in available_sources if s in allowed_sources]
                if not available_sources:
                     return [], []

            logger.info(f"[RAG] Documentos considerados: {available_sources}")

            # 2. Classifica a query
            query_type, specific_doc = self.classify_query(query_text, available_sources)
            logger.info(f"[RAG] Tipo de query: {query_type.value}, Doc específico: {specific_doc}")

            # 3. Executa estratégia de busca apropriada
            if query_type == QueryType.SPECIFIC and specific_doc:
                doc_contexts = self._search_specific_document(
                    query_text, user_id, bot_id, specific_doc, limit
                )
            elif query_type == QueryType.REFERENCE:
                target_source = recent_doc_source
                if target_source and target_source not in available_sources:
                    target_source = None

                if not target_source and available_sources:
                    target_source = available_sources[0]

                doc_contexts = self._search_specific_document(
                    query_text, user_id, bot_id, target_source, limit
                ) if target_source else []
            elif query_type == QueryType.COMPARATIVE:
                doc_contexts = self._search_comparative(
                    query_text, user_id, bot_id, available_sources, limit
                )
            else:  # GENERAL
                doc_contexts = self._search_general(
                    query_text, user_id, bot_id, limit, allowed_sources
                )

            # 4. Busca memórias (sempre complementar)
            memory_contexts = self._search_memories(query_text, user_id, bot_id, limit=3)

            return doc_contexts, memory_contexts

        except Exception as e:
            logger.error(f"Erro em search_context: {e}")
            return [], []

    def _search_specific_document(
        self, query: str, user_id: int, bot_id: int, source: str, limit: int
    ) -> List[str]:
        """Busca em um documento específico."""
        embedding = self._get_embedding(query, "retrieval_query")
        if not embedding:
            return []

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=limit,
            where={
                "$and": [
                    {"user_id": str(user_id)},
                    {"bot_id": {"$in": [str(bot_id), "0"]}},
                    {"type": "document"},
                    {"source": source}
                ]
            }
        )

        return self._format_doc_results(results)

    def _search_comparative(
        self, query: str, user_id: int, bot_id: int, sources: List[str], limit: int
    ) -> List[str]:
        """
        Busca comparativa - garante resultados de múltiplos documentos.
        """
        embedding = self._get_embedding(query, "retrieval_query")
        if not embedding:
            return []

        all_results = []
        per_doc_limit = max(2, limit // len(sources)) if sources else limit

        for source in sources[:4]:  # Máximo 4 documentos para comparação
            results = self.collection.query(
                query_embeddings=[embedding],
                n_results=per_doc_limit,
                where={
                    "$and": [
                        {"user_id": str(user_id)},
                        {"bot_id": {"$in": [str(bot_id), "0"]}},
                        {"type": "document"},
                        {"source": source}
                    ]
                }
            )
            all_results.extend(self._format_doc_results(results))

        return all_results[:limit]

    def _search_general(
        self, query: str, user_id: int, bot_id: int, limit: int, allowed_sources: Optional[List[str]] = None
    ) -> List[str]:
        """
        Busca geral com diversificação de fontes (Reranking).
        Garante pelo menos 1 chunk por documento relevante quando possível.
        """
        embedding = self._get_embedding(query, "retrieval_query")
        if not embedding:
            return []

        where_clause = {
            "$and": [
                {"user_id": str(user_id)},
                {"bot_id": {"$in": [str(bot_id), "0"]}},
                {"type": "document"}
            ]
        }

        if allowed_sources is not None:
            if len(allowed_sources) > 0:
                where_clause["$and"].append({"source": {"$in": allowed_sources}})
            else:
                return []

        # Fetch candidates (3x limit) para reranking
        fetch_k = limit * 3
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=fetch_k,
            where=where_clause
        )

        if not results or not results['documents'] or not results['documents'][0]:
            return []

        # Parse results into structured candidates
        candidates = []
        docs = results['documents'][0]
        metas = results['metadatas'][0]
        distances = results['distances'][0] if 'distances' in results and results['distances'] else [0.0] * len(docs)

        for i in range(len(docs)):
            candidates.append({
                'doc': docs[i],
                'meta': metas[i],
                'dist': distances[i],
                'source': metas[i].get('source', 'Unknown')
            })

        # Sort by distance (lower is better in Chroma)
        candidates.sort(key=lambda x: x['dist'])

        # Reranking Logic:
        # 1. Pick top chunk from each unique source
        # 2. Fill remaining slots with next best chunks (respecting per-doc limit)
        final_selection = []
        seen_sources = set()
        source_counts = {}
        MAX_PER_DOC = 2  # Max chunks per document in final list

        # Pass 1: Diversity (One from each)
        diversity_picks = []
        remaining_candidates = []

        for c in candidates:
            src = c['source']
            if src not in seen_sources:
                diversity_picks.append(c)
                seen_sources.add(src)
                source_counts[src] = 1
            else:
                remaining_candidates.append(c)

        # Apply diversity picks first (up to limit)
        final_selection.extend(diversity_picks[:limit])

        # Pass 2: Relevance (Fill remaining slots)
        if len(final_selection) < limit:
            needed = limit - len(final_selection)

            for c in remaining_candidates:
                if len(final_selection) >= limit: break

                src = c['source']
                current_count = source_counts.get(src, 0)

                if current_count < MAX_PER_DOC:
                    final_selection.append(c)
                    source_counts[src] = current_count + 1

        # Re-sort final selection by relevance for the prompt
        final_selection.sort(key=lambda x: x['dist'])

        # Logging for observability
        selected_sources = [c['source'] for c in final_selection]
        logger.info(f"[RAG Diversity] Selected {len(final_selection)} chunks from: {selected_sources}")

        return self._format_candidates(final_selection)

    def _format_candidates(self, candidates: List[dict]) -> List[str]:
        """Helper to format parsed candidates list."""
        contexts = []
        for c in candidates:
            source = c['meta'].get('source', 'Documento')
            chunk_idx = c['meta'].get('chunk_index', 0)
            total = c['meta'].get('total_chunks', 1)
            header = f"[DOCUMENTO: {source} (trecho {chunk_idx + 1}/{total})]"
            contexts.append(f"{header}\n{c['doc']}")
        return contexts

    def _search_memories(
        self, query: str, user_id: int, bot_id: int, limit: int
    ) -> List[str]:
        """Busca apenas memórias de conversação."""
        embedding = self._get_embedding(query, "retrieval_query")
        if not embedding:
            return []

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=limit,
            where={
                "$and": [
                    {"user_id": str(user_id)},
                    {"bot_id": str(bot_id)},
                    {"type": "memory"}
                ]
            }
        )

        contexts = []
        if results and results['documents'] and results['documents'][0]:
            for doc in results['documents'][0]:
                contexts.append(f"[MEMÓRIA]\n{doc}")

        return contexts

    def _format_doc_results(self, results: dict) -> List[str]:
        """Formata resultados de documentos com fonte clara."""
        contexts = []

        if not results or not results['documents'] or not results['documents'][0]:
            return contexts

        for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
            source = meta.get('source', 'Documento')
            chunk_idx = meta.get('chunk_index', 0)
            total = meta.get('total_chunks', 1)

            # Formato claro para a IA saber de onde vem cada trecho
            header = f"[DOCUMENTO: {source} (trecho {chunk_idx + 1}/{total})]"
            contexts.append(f"{header}\n{doc}")

        return contexts

# Instância global singleton exportada
vector_service = VectorService()
