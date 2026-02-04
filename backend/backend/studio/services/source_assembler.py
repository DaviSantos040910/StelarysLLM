import logging
from chat.models import ChatMessage
from studio.models import KnowledgeSource
from chat.file_processor import FileProcessor
from chat.services.token_service import TokenService
from chat.services.context_builder import build_conversation_history

logger = logging.getLogger(__name__)

class SourceAssemblyService:
    # Safety limit for context (Gemini 1.5 Pro is 1M+, Flash is 1M. We set a safe margin)
    MAX_CONTEXT_TOKENS = 200_000

    @staticmethod
    def get_context_from_config(chat_id: int, config: dict) -> str:
        """
        Reúne o conteúdo bruto dos arquivos selecionados.

        Args:
            chat_id: ID do chat.
            config: Dicionário contendo:
                - selectedSourceIds (list[int/str]): IDs das fontes (KnowledgeSource).

        Returns:
            str: O contexto montado pronto para o LLM.
        """
        context_parts = []
        current_tokens = 0

        # 1. Processar Arquivos Selecionados
        source_ids = config.get('selectedSourceIds', [])
        if source_ids:
            # New Logic: Query KnowledgeSource directly
            # We assume frontend passes KnowledgeSource IDs (as strings or ints)
            # We filter by ID. Ideally we should filter by user access too, but ContextSourcesView already did that.

            # Sanitizar IDs (remover prefixos se houver, mas decidimos não usar prefixos por enquanto)
            clean_ids = [str(sid) for sid in source_ids]

            sources = KnowledgeSource.objects.filter(id__in=clean_ids)

            for source in sources:
                # Check if we already hit the limit
                if current_tokens >= SourceAssemblyService.MAX_CONTEXT_TOKENS:
                    logger.warning(f"Context limit reached ({SourceAssemblyService.MAX_CONTEXT_TOKENS}). Skipping remaining files.")
                    context_parts.append("\n[SYSTEM: Maximum context size reached. Remaining files omitted.]")
                    break

                # Use extracted_text directly
                content = source.extracted_text
                title = source.title

                if not content and source.file:
                    try:
                        logger.info(f"Extracting text for source {source.id} (File: {title})")
                        content = FileProcessor.extract_text(source.file.path)
                        if content:
                            source.extracted_text = content
                            source.save(update_fields=['extracted_text'])
                    except Exception as e:
                        logger.error(f"Error extracting text for source {source.id}: {e}")

                if content:
                    # Estimate tokens for this file
                    file_tokens = TokenService.estimate_tokens(content)

                    # Check if adding this file exceeds limit
                    if current_tokens + file_tokens > SourceAssemblyService.MAX_CONTEXT_TOKENS:
                        # Calculate how much space is left
                        space_left = SourceAssemblyService.MAX_CONTEXT_TOKENS - current_tokens
                        if space_left > 100: # Only include if reasonable chunk remains
                            truncated_content = TokenService.truncate_to_token_limit(content, space_left)
                            context_parts.append(f"\n--- SOURCE: {title} (Partial) ---\n{truncated_content}")
                            current_tokens += space_left
                        else:
                            logger.warning(f"Skipping source {title} due to full context.")
                    else:
                        context_parts.append(f"\n--- SOURCE: {title} ---\n{content}")
                        current_tokens += file_tokens
                else:
                     logger.warning(f"Conteúdo vazio para fonte {title} (ID: {source.id})")

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
