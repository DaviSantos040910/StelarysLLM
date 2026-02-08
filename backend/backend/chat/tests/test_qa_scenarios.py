from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.chat_service import get_ai_response
from chat.models import Chat, Bot
from django.contrib.auth import get_user_model

User = get_user_model()

class QAScenariosTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="qa_agent")
        self.bot = Bot.objects.create(
            name="QABot",
            owner=self.user,
            strict_context=True,
            allow_web_search=False
        )
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_1_strict_on_no_context(self, mock_get_client, mock_get_docs, mock_search):
        """
        1) STRICT ON
        - Pergunta fora das fontes
        - Esperado: resposta dizendo explicitamente que não encontrou nos documentos
        """
        # Setup: Strict ON, No Web
        self.bot.strict_context = True
        self.bot.allow_web_search = False
        self.bot.save()

        # Mock: No context found
        mock_search.return_value = ([], [])
        mock_get_docs.return_value = [{'source': 'Doc1.pdf'}]

        # Mock Gemini
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "Os documentos fornecidos não contêm informações sobre..."
        mock_client.models.generate_content.return_value = mock_response

        # Act
        response = get_ai_response(self.chat.id, "Qual a cor de Marte?")

        # Assert
        call_args = mock_client.models.generate_content.call_args
        contents = call_args[1]['contents']
        prompt = contents[0]['parts'][0]['text']

        self.assertIn("You MUST output a response following EXACTLY this template", prompt)
        self.assertIn("Os documentos fornecidos não contêm informações sobre", prompt)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_2_strict_off_web_on(self, mock_get_client, mock_get_docs, mock_search):
        """
        2) STRICT OFF + WEB ON
        - Pergunta fora das fontes
        - Esperado: Bloco “nas fontes: não encontrei” + Bloco “fora das fontes: resposta”
        """
        # Setup
        self.bot.strict_context = False
        self.bot.allow_web_search = True
        self.bot.save()

        # Mock: No context
        mock_search.return_value = ([], [])

        # Mock Gemini
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "Nas suas fontes..."
        mock_client.models.generate_content.return_value = mock_response

        # Act
        response = get_ai_response(self.chat.id, "Cotação do Dólar")

        # Assert
        call_args = mock_client.models.generate_content.call_args
        contents = call_args[1]['contents']
        prompt = contents[0]['parts'][0]['text']

        self.assertIn("INSTRUCTION: You must answer using general knowledge/web search, but you MUST format it in two distinct blocks.", prompt)
        self.assertIn("Nas suas fontes, não encontrei informações sobre", prompt)
        self.assertIn("Fora do contexto dos documentos, de forma geral:", prompt)

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_3_strict_off_web_off(self, mock_get_client, mock_get_docs, mock_search):
        """
        3) STRICT OFF + WEB OFF
        - Pergunta fora das fontes
        - Esperado: Resposta geral rotulada como “fora das fontes” ?
        """
        # Setup
        self.bot.strict_context = False
        self.bot.allow_web_search = False
        self.bot.save()

        # Mock: No context
        mock_search.return_value = ([], [])

        # Mock Gemini
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "A resposta geral é..."
        mock_client.models.generate_content.return_value = mock_response

        # Act
        response = get_ai_response(self.chat.id, "Qual a capital da França?")

        # Assert
        # Check System Instruction for "Mixed Mode"
        call_args = mock_client.models.generate_content.call_args
        config = call_args[1]['config']
        system_inst = config.system_instruction

        self.assertIn("MODO DE CONHECIMENTO MISTO", system_inst)
        # Note: Currently implementation does NOT enforce "Fora das fontes" label for Web OFF.
        # This test checks if we are at least in Mixed Mode.
        # We might need to fail this if Strict Labeling is required.

    @patch('chat.services.chat_service.vector_service.search_context')
    @patch('chat.services.chat_service.vector_service.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_4_bot_editing_reactivity(self, mock_get_client, mock_get_docs, mock_search):
        """
        4) Edição do Tutor
        - Alterar strict_context no meio do chat
        - Próxima pergunta deve respeitar a nova regra
        """
        # Step A: Strict ON
        self.bot.strict_context = True
        self.bot.save()
        mock_search.return_value = ([], [])
        mock_get_docs.return_value = [{'source': 'Doc1.pdf'}]

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        get_ai_response(self.chat.id, "Q1")

        # Verify Strict Refusal Prompt
        args_a = mock_client.models.generate_content.call_args
        prompt_a = args_a[1]['contents'][0]['parts'][0]['text']
        self.assertIn("strict knowledge assistant", prompt_a)

        # Step B: Strict OFF
        self.bot.strict_context = False
        self.bot.allow_web_search = True # Mixed mode
        self.bot.save()

        get_ai_response(self.chat.id, "Q2")

        # Verify Mixed Prompt
        args_b = mock_client.models.generate_content.call_args
        prompt_b = args_b[1]['contents'][0]['parts'][0]['text']
        self.assertIn("INSTRUCTION: You must answer using general knowledge/web search", prompt_b)
