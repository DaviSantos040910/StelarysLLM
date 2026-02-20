# chat/vector_service.py
"""
Serviço vetorial com suporte inteligente a múltiplos documentos.
"""

from django.conf import settings
import logging
import uuid
from datetime import datetime
import os
import re
from typing import List, Dict, Optional, Tuple, Union
from enum import Enum
from chat.vector_store.base import VectorStoreBackend
from chat.vector_store.chroma import ChromaBackend
from chat.vector_store.pgvector import PGVectorBackend
from studio.models import KnowledgeSource

# Use google.genai optionally
try:
    from google import genai
except ImportError:
    genai = None

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
        self.backend: Optional[VectorStoreBackend] = None
        self._initialize()

    def _initialize(self) -> None:
        """Inicializa Backend Vetorial e API Gemini."""
        try:
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                logger.error("GEMINI_API_KEY não encontrada.")
                # Continua sem backend, mas _get_embedding retornará dummy
                return

            if genai:
                # Using google.genai client initialization is slightly different.
                self.genai_client = genai.Client(api_key=api_key)
            else:
                logger.warning("google.genai module not found. Embeddings will be dummy.")

            backend_type = getattr(settings, 'VECTOR_DB_BACKEND', 'chroma')

            if backend_type == 'pgvector':
                self.backend = PGVectorBackend()
            else:
                try:
                    self.backend = ChromaBackend()
                except ImportError as e:
                     logger.warning(f"ChromaBackend unavailable: {e}. Vector search disabled.")
                     self.backend = None

            logger.info(f"VectorService inicializado com backend: {backend_type}")

        except Exception as e:
            logger.critical(f"Falha ao inicializar VectorService: {e}")

    def _get_embedding(self, text: str, task_type: str = "retrieval_document") -> List[float]:
        """Gera embedding usando Gemini com fallback de modelos."""
        dummy_embedding = [0.0] * 768

        try:
            if not text or len(text.strip()) < 3:
                return dummy_embedding

            # Se não tem cliente (sem API key ou module missing), retorna dummy
            if not hasattr(self, 'genai_client') or not self.genai_client:
                 return dummy_embedding

            models_to_try = ["models/gemini-embedding-001", "gemini-embedding-001", "text-embedding-004"]

            for model in models_to_try:
                try:
                    response = self.genai_client.models.embed_content(
                        model=model,
                        contents=text[:8000],
                    )

                    if response.embeddings:
                        return response.embeddings[0].values
                except Exception as e:
                    # Loga erro apenas se não for 404 comum
                    if "404" not in str(e) and "NOT_FOUND" not in str(e):
                        logger.error(f"Erro ao gerar embedding com {model}: {e}")
                    continue
        except Exception:
            pass

        # Fallback final absoluto
        return dummy_embedding

    # =========================================================================
    # HELPERS DE FILTRO (SAFE WHERE)
    # =========================================================================

    def _safe_and(self, conditions: List[Dict]) -> Dict:
        """Retorna filtro $and seguro ou condição única."""
        valid = [c for c in conditions if c]
        if not valid:
            return {}
        if len(valid) == 1:
            return valid[0]
        return {"$and": valid}

    def _safe_or(self, conditions: List[Dict]) -> Dict:
        """Retorna filtro $or seguro ou condição única."""
        valid = [c for c in conditions if c]
        if not valid:
            return {}
        if len(valid) == 1:
            return valid[0]
        return {"$or": valid}

    def _log_debug(self, msg: str, data: any = None):
        """Loga apenas se RAG_DEBUG=1."""
        if os.environ.get('RAG_DEBUG') == '1':
            logger.info(f"[RAG_DEBUG] {msg} {data if data else ''}")

    # =========================================================================
    # MÉTODOS DE ADIÇÃO
    # =========================================================================

    def add_memory(self, user_id: int, bot_id: int, text: str, role: str) -> None:
        """Adiciona memória de conversação."""
        if not self.backend or not text:
            return

        try:
            embedding = self._get_embedding(text)

            self.backend.add_documents(
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
        chunks: List[str],
        source_name: str,
        source_id: str,
        bot_id: Optional[int] = None,
        study_space_id: Optional[int] = None,
        message_id: Optional[int] = None
    ) -> None:
        """Adiciona chunks de documento com metadados completos."""
        if not self.backend or not chunks:
            return

        logger.info(f"Indexando {len(chunks)} chunks de '{source_name}' (Space: {study_space_id}, Bot: {bot_id})")

        docs, embeds, metas, ids = [], [], [], []
        timestamp = datetime.now().isoformat()

        for i, chunk in enumerate(chunks):
            embedding = self._get_embedding(chunk)

            docs.append(chunk)
            embeds.append(embedding)
            ids.append(str(uuid.uuid4()))
            
            meta = {
                'user_id': str(user_id),
                'type': 'document',
                'source': source_name,
                'source_id': str(source_id),
                'source_title': source_name,
                'source_lower': source_name.lower(),
                'chunk_index': i,
                'total_chunks': len(chunks),
                'timestamp': timestamp,
                'message_id': str(message_id) if message_id else ''
            }
            
            if bot_id is not None:
                meta['bot_id'] = str(bot_id)
            else:
                meta['bot_id'] = ''
                
            if study_space_id is not None:
                meta['study_space_id'] = str(study_space_id)
            else:
                meta['study_space_id'] = ''

            metas.append(meta)

        if docs:
            try:
                self.backend.add_documents(
                    documents=docs, embeddings=embeds, metadatas=metas, ids=ids
                )
                logger.info(f"RAG: {len(docs)} chunks indexados de '{source_name}'")
            except Exception as e:
                logger.error(f"Erro ao indexar documento: {e}")

    # =========================================================================
    # MÉTODOS DE ANÁLISE DE QUERY
    # =========================================================================

    def classify_query(self, query: str, available_sources: List[str]) -> Tuple[QueryType, Optional[str]]:
        """Classifica o tipo de query."""
        query_lower = query.lower()

        for source in available_sources:
            source_lower = source.lower()
            source_base = os.path.splitext(source_lower)[0]
            if source_lower in query_lower or source_base in query_lower:
                return QueryType.SPECIFIC, source

        comparative_patterns = [
            r'\b(compare|comparar|diferença|diferente|versus|vs\.?|entre os)\b',
            r'\b(os dois|ambos|os documentos|os arquivos)\b',
            r'\b(primeiro|segundo|terceiro)\s+(documento|arquivo)\b'
        ]
        if any(re.search(p, query_lower) for p in comparative_patterns):
            return QueryType.COMPARATIVE, None

        reference_patterns = [
            r'\b(isso|isto|esse|este|essa|esta)\b',
            r'\b(esse|este|o)\s+(documento|arquivo|pdf|texto)\b',
            r'\bresuma\s*(isso|isto|esse|este)?\b',
            r'\bexplique\s*(isso|isto|esse|este)?\b',
            r'\bo que (é|são|diz|fala)\s*(isso|isto|esse|este)?\b'
        ]
        if any(re.search(p, query_lower) for p in reference_patterns):
            return QueryType.REFERENCE, None

        return QueryType.GENERAL, None

    def get_available_documents(
        self, 
        user_id: int, 
        bot_id: int, 
        study_space_ids: Optional[List[int]] = None,
        chat_id: Optional[int] = None
    ) -> List[Dict]:
        """Lista todos os documentos disponíveis."""
        # Se backend não existe e sem mock, nada a fazer.
        # Mas para "available documents names" (usado no prompt), podemos pegar do DB KnowledgeSource?
        # O prompt usa available_docs para listar nomes.
        # A implementação antiga buscava do vector DB.
        # O pedido da issue é: "corrigir _get_available_documents que está quebrado"
        # "Carregar o chat e usar chat.sources.all()"

        # Estratégia Híbrida/Correta:
        # Para listar nomes disponíveis para o prompt (context window),
        # devemos confiar no que está vinculado ao chat/bot no DB Relacional (KnowledgeSource),
        # pois o VectorDB pode estar desatualizado ou inacessível.
        # No entanto, a assinatura pede documentos "indexados".
        # Se o user pede "resuma X", X deve estar no RAG.

        # Vamos seguir a instrução explícita: "usar chat.sources.all()"

        docs_list = []

        try:
            # 1. Sources do Chat
            if chat_id:
                # Filter KnowledgeSources linked to this chat
                chat_sources = KnowledgeSource.objects.filter(chats__id=chat_id).values('title', 'created_at', 'id')
                for cs in chat_sources:
                    docs_list.append({
                        'source': cs['title'],
                        'source_id': str(cs['id']),
                        'timestamp': cs['created_at'].isoformat() if cs['created_at'] else ''
                    })

            # 2. Sources do Bot (via StudySpaces)
            # Se não tiver study_space_ids passado, tenta inferir?
            # O caller geralmente passa.
            if study_space_ids:
                space_sources = KnowledgeSource.objects.filter(study_spaces__id__in=study_space_ids).values('title', 'created_at', 'id')
                for ss in space_sources:
                     docs_list.append({
                        'source': ss['title'],
                        'source_id': str(ss['id']),
                        'timestamp': ss['created_at'].isoformat() if ss['created_at'] else ''
                    })

            # Deduplicate by source name (title)
            # Prefer newest timestamp
            unique_docs = {}
            for d in docs_list:
                title = d['source']
                if title not in unique_docs:
                    unique_docs[title] = d
                # else: could check timestamp, but usually title uniqueness is enough for context listing

            return list(unique_docs.values())

        except Exception as e:
            logger.error(f"Erro ao listar documentos (DB Relacional): {e}")
            return []

    # =========================================================================
    # HELPER DE EXECUÇÃO DE BUSCA (BACKEND vs MOCK)
    # =========================================================================

    def _execute_search(self, query_embedding: List[float], limit: int, where: Dict) -> Dict:
        """Executa busca no backend ou mock (collection). Normaliza retorno para Dict."""
        try:
            if self.backend:
                # Backend search (ChromaBackend returns dict usually)
                results = self.backend.search(
                    query_embedding=query_embedding,
                    limit=limit,
                    where=where
                )
            elif hasattr(self, 'collection'):
                # Fallback para Mock (collection.query)
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where=where
                )
            else:
                return {'documents': [], 'metadatas': [], 'distances': []}

            # Normalização (garante que é dict)
            if isinstance(results, tuple):
                 # Se por acaso retornar tuple (legacy), converte
                 # Assumindo (results, metadatas, distances)
                 return {
                     'documents': results[0] if len(results) > 0 else [],
                     'metadatas': results[1] if len(results) > 1 else [],
                     'distances': results[2] if len(results) > 2 else []
                 }

            return results

        except Exception as e:
            logger.error(f"Erro em _execute_search: {e}")
            return {'documents': [], 'metadatas': [], 'distances': []}

    # =========================================================================
    # MÉTODO PRINCIPAL DE BUSCA
    # =========================================================================

    def search_context(
        self,
        query_text: str,
        user_id: int,
        bot_id: int,
        study_space_ids: Optional[List[int]] = None,
        limit: int = 6,
        recent_doc_source: Optional[str] = None,
        allowed_source_ids: Optional[List[str]] = None,
        allowed_sources: Optional[List[str]] = None,
        chat_id: Optional[int] = None # Added chat_id param
    ) -> Tuple[List[Dict], List[str]]:
        """
        Busca inteligente com suporte a múltiplos documentos.
        Returns: (doc_contexts, memory_contexts)
        doc_contexts includes 'score' now.
        """
        # Cheque básico de query
        if not query_text or not query_text.strip():
            return [], []

        # Não abortar se backend for None, pois pode ter mock collection

        try:
            available_docs = self.get_available_documents(user_id, bot_id, study_space_ids, chat_id=chat_id)
            
            # Filtra por ID se fornecido
            if allowed_source_ids:
                # Optional: Pre-filter available_docs?
                # Not strictly needed for logic flow, but good for "available_sources" list passed to classifier
                available_docs = [d for d in available_docs if d.get('source_id') in allowed_source_ids]

            available_sources = [d['source'] for d in available_docs]
            
            query_type, specific_doc = self.classify_query(query_text, available_sources)
            logger.info(f"[RAG] Tipo de query: {query_type.value}, Doc específico: {specific_doc}")

            doc_contexts = []
            if query_type == QueryType.SPECIFIC and specific_doc:
                doc_contexts = self._search_specific_document(
                    query_text, user_id, bot_id, specific_doc, limit, study_space_ids, allowed_source_ids
                )
            elif query_type == QueryType.REFERENCE:
                target_source = recent_doc_source
                if target_source and target_source not in available_sources:
                    target_source = None
                if not target_source and available_sources:
                    target_source = available_sources[0]

                doc_contexts = self._search_specific_document(
                    query_text, user_id, bot_id, target_source, limit, study_space_ids, allowed_source_ids
                ) if target_source else []
            elif query_type == QueryType.COMPARATIVE:
                doc_contexts = self._search_comparative(
                    query_text, user_id, bot_id, available_sources, limit, study_space_ids, allowed_source_ids
                )
            else:  # GENERAL
                doc_contexts = self._search_general(
                    query_text, user_id, bot_id, limit, allowed_source_ids, study_space_ids
                )

            memory_contexts = self._search_memories(query_text, user_id, bot_id, limit=3)

            return doc_contexts, memory_contexts

        except Exception as e:
            logger.error(f"Erro em search_context: {e}")
            return [], []

    def _build_or_filter(self, user_id: int, bot_id: int, study_space_ids: Optional[List[int]]) -> dict:
        or_list = [
            {"bot_id": str(bot_id)},
            {"bot_id": "0"} 
        ]
        if study_space_ids:
            for sid in study_space_ids:
                or_list.append({"study_space_id": str(sid)})
        
        scope_condition = self._safe_or(or_list)

        and_list = [
            {"user_id": str(user_id)},
            {"type": "document"}
        ]
        if scope_condition:
            and_list.append(scope_condition)

        return self._safe_and(and_list)

    def _search_specific_document(
        self, query: str, user_id: int, bot_id: int, source: str, limit: int, study_space_ids: Optional[List[int]] = None, allowed_source_ids: Optional[List[str]] = None
    ) -> List[Dict]:
        """Busca em um documento específico."""
        embedding = self._get_embedding(query, "retrieval_query")
        
        where_clause = self._build_or_filter(user_id, bot_id, study_space_ids)
        
        if "$and" in where_clause:
            and_conditions = where_clause["$and"]
        else:
            and_conditions = [where_clause] if where_clause else []

        and_conditions.append({"source": source})
        
        if allowed_source_ids:
            and_conditions.append({"source_id": {"$in": allowed_source_ids}})

        final_where = {"$and": and_conditions}
        
        results = self._execute_search(
            query_embedding=embedding,
            limit=limit,
            where=final_where
        )

        return self._format_doc_results(results)

    def _search_comparative(
        self, query: str, user_id: int, bot_id: int, sources: List[str], limit: int, study_space_ids: Optional[List[int]] = None, allowed_source_ids: Optional[List[str]] = None
    ) -> List[Dict]:
        """Busca comparativa."""
        embedding = self._get_embedding(query, "retrieval_query")

        all_results = []
        per_doc_limit = max(2, limit // len(sources)) if sources else limit

        for source in sources[:4]:
            where_clause = self._build_or_filter(user_id, bot_id, study_space_ids)
            
            if "$and" in where_clause:
                and_conditions = where_clause["$and"]
            else:
                and_conditions = [where_clause] if where_clause else []

            and_conditions.append({"source": source})
            
            if allowed_source_ids:
                and_conditions.append({"source_id": {"$in": allowed_source_ids}})
            
            final_where = {"$and": and_conditions}

            results = self._execute_search(
                query_embedding=embedding,
                limit=per_doc_limit,
                where=final_where
            )
            all_results.extend(self._format_doc_results(results))

        return all_results[:limit]

    def _search_general(
        self, query: str, user_id: int, bot_id: int, limit: int, allowed_source_ids: Optional[List[str]] = None, study_space_ids: Optional[List[int]] = None
    ) -> List[Dict]:
        """Busca geral com diversificação e pontuação."""
        embedding = self._get_embedding(query, "retrieval_query")

        where_clause = self._build_or_filter(user_id, bot_id, study_space_ids)

        if allowed_source_ids is not None:
            if "$and" in where_clause:
                and_conditions = where_clause["$and"]
            else:
                and_conditions = [where_clause] if where_clause else []

            if len(allowed_source_ids) > 0:
                and_conditions.append({"source_id": {"$in": allowed_source_ids}})
            else:
                # If allowed list is empty, return empty (nothing allowed)
                # UNLESS we treat empty list as "none allowed" -> return empty.
                return []
            
            where_clause = {"$and": and_conditions}

        # Fetch candidates (3x limit) para reranking
        fetch_k = limit * 3
        results = self._execute_search(
            query_embedding=embedding,
            limit=fetch_k,
            where=where_clause
        )

        if not results or not results.get('documents') or not results['documents'][0]:
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

        candidates.sort(key=lambda x: x['dist'])

        # NOTE: Threshold logic here is kept for general quality, but EvidenceGate will apply stricter logic later.
        # We can relax here slightly to let EvidenceGate decide.
        SIMILARITY_THRESHOLD = 0.60 # Relaxed for retrieval, stricter check downstream

        final_selection = []
        seen_sources = set()
        source_counts = {}
        MAX_PER_DOC = 2

        # Pass 1: Diversity
        diversity_picks = []
        remaining_candidates = []

        for c in candidates:
            if c['dist'] > SIMILARITY_THRESHOLD:
                continue

            src = c['source']
            if src not in seen_sources:
                diversity_picks.append(c)
                seen_sources.add(src)
                source_counts[src] = 1
            else:
                remaining_candidates.append(c)

        final_selection.extend(diversity_picks[:limit])

        # Pass 2: Relevance (Fill)
        if len(final_selection) < limit:
            needed = limit - len(final_selection)
            for c in remaining_candidates:
                if len(final_selection) >= limit: break
                src = c['source']
                current_count = source_counts.get(src, 0)
                if current_count < MAX_PER_DOC:
                    final_selection.append(c)
                    source_counts[src] = current_count + 1

        final_selection.sort(key=lambda x: x['dist'])

        logger.info(f"[RAG Diversity] Selected {len(final_selection)} chunks from {len(candidates)} candidates.")

        return self._format_candidates(final_selection)

    def _format_candidates(self, candidates: List[dict]) -> List[Dict]:
        """Helper to format parsed candidates list."""
        contexts = []
        for c in candidates:
            meta = c['meta']
            contexts.append({
                'content': c['doc'],
                'source': meta.get('source', 'Documento'),
                'source_id': meta.get('source_id') or meta.get('source') or meta.get('source_pk') or '',
                'title': meta.get('title') or meta.get('source_title') or meta.get('source') or 'Documento',
                'chunk_index': meta.get('chunk_index', 0),
                'total_chunks': meta.get('total_chunks', 1),
                'score': c['dist'] # Added score (distance)
            })
        return contexts

    def _search_memories(
        self, query: str, user_id: int, bot_id: int, limit: int
    ) -> List[str]:
        """Busca apenas memórias."""
        embedding = self._get_embedding(query, "retrieval_query")

        where_clause = {
                "$and": [
                    {"user_id": str(user_id)},
                    {"bot_id": str(bot_id)},
                    {"type": "memory"}
                ]
            }
        
        results = self._execute_search(
            query_embedding=embedding,
            limit=limit,
            where=where_clause
        )

        contexts = []
        if results and results.get('documents') and results['documents'][0]:
            for doc in results['documents'][0]:
                contexts.append(f"[MEMÓRIA]\n{doc}")

        return contexts

    def _format_doc_results(self, results: dict) -> List[Dict]:
        """Formata resultados de documentos com score."""
        contexts = []

        if not results or not results.get('documents') or not results['documents'][0]:
            return contexts

        docs = results['documents'][0]
        metas = results['metadatas'][0]
        # Distances might be missing if not requested, but usually are
        dists = results['distances'][0] if 'distances' in results and results['distances'] else [0.0] * len(docs)

        for doc, meta, dist in zip(docs, metas, dists):
            contexts.append({
                'content': doc,
                'source': meta.get('source', 'Documento'),
                'source_id': meta.get('source_id') or meta.get('source') or meta.get('source_pk') or '',
                'title': meta.get('title') or meta.get('source_title') or meta.get('source') or 'Documento',
                'chunk_index': meta.get('chunk_index', 0),
                'total_chunks': meta.get('total_chunks', 1),
                'score': dist
            })

        return contexts

    def migrate_owner(self, old_owner_id: str, new_owner_id: str) -> int:
        """Migra vetores de um usuário/guest para outro."""
        if not self.backend:
            return 0

        try:
            # 1. Fetch IDs owned by old_owner
            results = self.backend.get_documents(where={"user_id": str(old_owner_id)})

            ids = results.get('ids', [])
            metadatas = results.get('metadatas', [])

            if not ids:
                logger.info(f"[Vector Migration] No vectors found for {old_owner_id}")
                return 0

            # 2. Update metadatas
            new_metadatas = []
            for meta in metadatas:
                meta['user_id'] = str(new_owner_id)
                new_metadatas.append(meta)

            self.backend.update_documents(
                ids=ids,
                metadatas=new_metadatas
            )

            logger.info(f"[Vector Migration] Moved {len(ids)} chunks from {old_owner_id} to {new_owner_id}")
            return len(ids)

        except Exception as e:
            logger.error(f"Erro ao migrar vetores: {e}", exc_info=True)
            return 0

# Instância global singleton exportada
vector_service = VectorService()
