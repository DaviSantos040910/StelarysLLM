from django.test import TestCase
from chat.services.context_builder import build_system_instruction

class NotebookLMStyleTest(TestCase):
    def test_prompt_includes_notebooklm_guidelines(self):
        """Testa se o prompt de sistema contém as diretrizes do estilo NotebookLM."""

        prompt = build_system_instruction(
            bot_prompt="You are a tutor.",
            user_name="Tester",
            doc_contexts=["Chunk 1"],
            memory_contexts=[],
            current_time="2023-10-27",
            available_docs=["File1.pdf"]
        )

        # 1. Citações Obrigatórias
        self.assertIn("CITAÇÕES OBRIGATÓRIAS", prompt)
        self.assertIn("[Nome do Arquivo]", prompt)

        # 2. Estruturação em Tópicos
        self.assertIn("ESTRUTURAÇÃO EM TÓPICOS", prompt)
        self.assertIn("bullet points", prompt)

        # 3. Fallback Rigoroso
        self.assertIn("FALLBACK RIGOROSO", prompt)
        self.assertIn("Não encontrei informações suficientes", prompt)

        # 4. Formatação
        self.assertIn("Markdown rico", prompt)
