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

        Args:
            chat_id: ID do chat.
            config: Dicionário contendo selectedSourceIds e includeChatHistory.
            query: Tópico/Título do artefato para guiar a busca vetorial.

        Returns:
            str: O contexto montado pronto para o LLM.
        """
        context_parts = []
        current_tokens = 0

        try:
            chat = Chat.objects.get(id=chat_id)
        except Chat.DoesNotExist:
            return ""

        # 1. RAG de Fontes Selecionadas
        source_ids = config.get('selectedSourceIds', [])
        if source_ids and query:
            clean_ids = [str(sid) for sid in source_ids]
            sources = KnowledgeSource.objects.filter(id__in=clean_ids)
            allowed_names = [s.title for s in sources]

            # Garante que os textos foram extraídos/indexados (lazy extraction fallback)
            for source in sources:
                if not source.extracted_text and source.file:
                    try:
                        content = FileProcessor.extract_text(source.file.path)
                        if content:
                            source.extracted_text = content
                            source.save(update_fields=['extracted_text'])
                            # Index on the fly if needed (idealmente já foi feito no upload)
                            chunks = FileProcessor.chunk_text(content)
                            vector_service.add_document_chunks(source.user.id, 0, chunks, source.title)
                    except Exception: pass

            # Busca Vetorial Top-K (Limit ~20 chunks)
            # allowed_sources filtra a busca apenas nos arquivos selecionados
            doc_contexts, _ = vector_service.search_context(
                query_text=query,
                user_id=chat.user_id,
                bot_id=chat.bot.id,
                limit=20,
                allowed_sources=allowed_names
            )

            if doc_contexts:
                rag_content = "\n".join(doc_contexts)
                rag_tokens = TokenService.estimate_tokens(rag_content)

                context_parts.append("## TRECHOS RELEVANTES DOS DOCUMENTOS SELECIONADOS\n")
                context_parts.append(rag_content)
                current_tokens += rag_tokens
            else:
                context_parts.append("[Nenhum trecho relevante encontrado nos arquivos selecionados para este tópico.]")

        # Fallback: Se não houver query (não deve ocorrer em artefatos), mas houver fontes, usa full text limitado?
        # Por enquanto, assumimos que Artifact Generation sempre tem query (title).


        # 2. Process Chat History (if requested)
        if config.get('includeChatHistory'):
            try:
                # Reuse context builder to get linear history
                # We only need text parts
                _, recent_texts = build_conversation_history(chat_id, limit=30)
                if recent_texts:
                    history_text = "\n".join(recent_texts)
                    hist_tokens = TokenService.estimate_tokens(history_text)

                    if current_tokens + hist_tokens <= SourceAssemblyService.MAX_CONTEXT_TOKENS:
                        context_parts.append(f"\n--- CHAT HISTORY ---\n{history_text}")
                        current_tokens += hist_tokens
                    else:
                        # Truncate if needed
                        space_left = SourceAssemblyService.MAX_CONTEXT_TOKENS - current_tokens
                        if space_left > 500:
                             truncated = TokenService.truncate_to_token_limit(history_text, space_left)
                             context_parts.append(f"\n--- CHAT HISTORY (Partial) ---\n{truncated}")
                             current_tokens += space_left
            except Exception as e:
                logger.error(f"Error appending chat history: {e}")

        return "\n".join(context_parts)
