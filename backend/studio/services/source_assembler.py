import logging
from chat.models import ChatMessage, Chat
from studio.models import KnowledgeSource
from chat.file_processor import FileProcessor
from chat.services.token_service import TokenService
from chat.services.context_builder import build_conversation_history
from chat.vector_service import vector_service
from django.conf import settings

logger = logging.getLogger(__name__)

class SourceAssemblyService:
    # Reduced limit for RAG context (focused chunks)
    MAX_CONTEXT_TOKENS = getattr(settings, 'MAX_RAG_CONTEXT_TOKENS', 50_000)

    @staticmethod
    def get_context_from_config(chat_id: int, config: dict, query: str = "") -> str:
        """
        Reúne trechos relevantes (RAG) dos arquivos selecionados.
        IGNORA EXPLICITAMENTE O HISTÓRICO DO CHAT.

        Args:
            chat_id: ID do chat.
            config: Dicionário contendo selectedSourceIds e includeChatHistory (ignorado).
            query: Tópico/Título do artefato para guiar a busca vetorial.

        Returns:
            str: O contexto montado pronto para o LLM.
        """
        context_parts = []
        current_tokens = 0

        # Log de conformidade
        if config.get('includeChatHistory'):
            logger.debug(f"[Artifact Generation] Chat history explicitly IGNORED/REMOVED from context assembly for chat {chat_id}.")

        try:
            chat = Chat.objects.select_related('bot').get(id=chat_id)
        except Chat.DoesNotExist:
            return ""

        # 1. RAG de Fontes Selecionadas
        source_ids = config.get('selectedSourceIds', [])
        if source_ids and query:
            clean_ids = [str(sid) for sid in source_ids]
            sources = KnowledgeSource.objects.filter(id__in=clean_ids)
            
            # Garante que os textos foram extraídos/indexados (lazy extraction fallback)
            for source in sources:
                if not source.extracted_text and source.file:
                    try:
                        content = FileProcessor.extract_text(source.file.path)
                        if content:
                            source.extracted_text = content
                            source.save(update_fields=['extracted_text'])
                            
                            # Lazy Indexing Logic
                            bot_study_spaces = set(chat.bot.study_spaces.values_list('id', flat=True)) if chat.bot else set()
                            source_study_spaces = set(source.study_spaces.values_list('id', flat=True))
                            
                            common_spaces = bot_study_spaces.intersection(source_study_spaces)
                            
                            target_study_space_id = list(common_spaces)[0] if common_spaces else None
                            
                            target_bot_id = chat.bot.id if not target_study_space_id else None
                            
                            chunks = FileProcessor.chunk_text(content)
                            vector_service.add_document_chunks(
                                user_id=source.user.id,
                                chunks=chunks,
                                source_name=source.title,
                                source_id=source.id,
                                bot_id=target_bot_id,
                                study_space_id=target_study_space_id
                            )
                    except Exception as e:
                        logger.error(f"Lazy indexing failed for source {source.id}: {e}")

            # Busca Vetorial Top-K (Limit ~20 chunks)
            study_space_ids = list(chat.bot.study_spaces.values_list('id', flat=True)) if chat.bot else []
            
            doc_contexts, _ = vector_service.search_context(
                query_text=query,
                user_id=chat.user_id,
                bot_id=chat.bot.id if chat.bot else 0,
                study_space_ids=study_space_ids,
                limit=20,
                allowed_source_ids=clean_ids
            )

            if doc_contexts:
                # doc_contexts is List[Dict] -> Format to String
                formatted_chunks = []
                for chunk in doc_contexts:
                    title = chunk.get('source', 'Documento')
                    content = chunk.get('content', '')
                    # Format matching standardized citation style
                    s_idx = chunk.get('source_id', '?') # Just ID or index? Vector service returns meta
                    # Ideally we want an index 1..N relative to this list, but RAG returns arbitrary chunks.
                    # Simple format: [Source: Title] Content
                    formatted_chunks.append(f"[Source: {title}]\n{content}")
                
                rag_content = "\n\n".join(formatted_chunks)
                rag_tokens = TokenService.estimate_tokens(rag_content)

                context_parts.append("## TRECHOS RELEVANTES DOS DOCUMENTOS SELECIONADOS\n")
                context_parts.append(rag_content)
                current_tokens += rag_tokens

                logger.info(f"[Artifact Context] Built {current_tokens} tokens from sources: {clean_ids}")
            else:
                context_parts.append("[Nenhum trecho relevante encontrado nos arquivos selecionados para este tópico.]")

        # 2. CHAT HISTORY REMOVED
        # O código antigo que concatenava histórico foi removido para garantir
        # que o artefato é gerado exclusivamente a partir das fontes.

        return "\n".join(context_parts)
