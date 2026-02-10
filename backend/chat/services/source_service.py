from typing import List, Optional
from studio.models import KnowledgeSource
from chat.vector_service import vector_service

class SourceService:
    @staticmethod
    def list_available_sources_for_bot(bot_id: int, user_id: int, study_space_ids: Optional[List[int]] = None) -> str:
        """
        Retorna uma string formatada com as fontes disponíveis para o bot/usuário.
        """
        # Reusa a lógica do VectorService para obter a lista (que já filtra por permissão/bot/espaço)
        # Mas vector_service.get_available_documents retorna dicts para RAG.
        # Aqui queremos uma lista legível.

        # Opção 1: Consultar VectorDB (Rápido se já indexado)
        docs = vector_service.get_available_documents(user_id, bot_id, study_space_ids)

        if not docs:
            return "Nenhuma fonte disponível no momento."

        # Formata a lista
        # docs é lista de {'source': 'Titulo', 'timestamp': ...}

        titles = sorted([d['source'] for d in docs])

        # Limita para não estourar contexto se houver milhares
        if len(titles) > 50:
            titles = titles[:50]
            suffix = "\n... (e mais)"
        else:
            suffix = ""

        formatted_list = "\n".join([f"- {t}" for t in titles])

        return f"Fontes disponíveis ({len(titles)}):\n{formatted_list}{suffix}"

source_service = SourceService()
