import re

class IntentService:
    @staticmethod
    def is_sources_list_intent(text: str) -> bool:
        """
        Detecta se o usuário quer saber quais fontes estão disponíveis.
        Ex: "quais documentos você tem?", "listar fontes", "o que você sabe?"
        """
        text = text.lower().strip()

        # Keywords fortes
        keywords = [
            r"quais (fontes|documentos|arquivos|textos)",
            r"listar (fontes|documentos)",
            r"quais são (as|suas) fontes",
            r"o que voc[êe] (tem|sabe)",
            r"quais dados",
            r"fontes dispon[íi]veis",
            r"what sources",
            r"list documents",
            r"what do you know"
        ]

        for pattern in keywords:
            if re.search(pattern, text):
                return True

        # Perguntas curtas muito específicas
        if text in ["fontes", "documentos", "sources", "docs"]:
            return True

        return False

intent_service = IntentService()
