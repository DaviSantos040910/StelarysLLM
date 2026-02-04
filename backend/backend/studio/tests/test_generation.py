from django.test import TestCase
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from chat.models import Chat
from bots.models import Bot
from studio.models import KnowledgeArtifact
from studio.schemas import QUIZ_SCHEMA
import json

User = get_user_model()

class ArtifactGenerationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create(username="testuser")
        self.client.force_authenticate(user=self.user)
        self.bot = Bot.objects.create(name="TestBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('studio.views.threading.Thread') # Mock threading
    @patch('chat.services.ai_client.genai.Client')
    @patch('chat.services.ai_client.get_model')
    @patch('chat.vector_service.VectorService.search_context')
    @patch('studio.services.source_assembler.SourceAssemblyService.get_context_from_config')
    def test_generate_quiz_structured(self, mock_assembler, mock_search_context, mock_get_model, mock_genai_client, mock_thread):
        """Testa a geração de Quiz usando schema estruturado (Async)."""

        # Setup do Thread mock para executar síncrono
        def side_effect(target, args):
            target(*args) # Executa a função alvo imediatamente
            return MagicMock() # Retorna um objeto thread dummy
        mock_thread.side_effect = side_effect

        # Mock do contexto
        mock_assembler.return_value = "Conteúdo relevante do documento."
        mock_search_context.return_value = ([], [])
        mock_get_model.return_value = 'gemini-2.5-flash-lite'

        # Mock do Client e Response
        mock_client_instance = MagicMock()
        mock_response = MagicMock()

        expected_content = [
            {
                "question": "Q1",
                "options": ["A", "B"],
                "correctAnswerIndex": 0
            }
        ]
        mock_response.parsed = expected_content
        mock_response.text = json.dumps(expected_content)

        mock_client_instance.models.generate_content.return_value = mock_response
        mock_genai_client.return_value = mock_client_instance

        payload = {
            "chat": self.chat.id,
            "type": "QUIZ",
            "title": "My Quiz",
            "quantity": 5,
            "source_ids": [1, 2]
        }

        response = self.client.post('/api/v1/studio/artifacts/', payload, format='json')

        # Verificações
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verifica se chamou Thread
        mock_thread.assert_called_once()

        # Verifica se salvou no banco (como executamos síncrono via side_effect, deve estar READY)
        artifact = KnowledgeArtifact.objects.get(title="My Quiz")
        self.assertEqual(artifact.status, KnowledgeArtifact.Status.READY)
        self.assertEqual(len(artifact.content), 1)
        self.assertEqual(artifact.content[0]['question'], "Q1")

        # Verifica chamadas da IA
        mock_client_instance.models.generate_content.assert_called_once()
        args, kwargs = mock_client_instance.models.generate_content.call_args
        self.assertIn('config', kwargs)

        # Verifica assembler
        mock_assembler.assert_called_once()

    @patch('studio.views.threading.Thread')
    @patch('chat.services.ai_client.genai.Client')
    @patch('chat.services.ai_client.get_model')
    @patch('chat.vector_service.VectorService.search_context')
    @patch('studio.services.source_assembler.SourceAssemblyService.get_context_from_config')
    def test_generate_summary_fallback(self, mock_assembler, mock_search_context, mock_get_model, mock_genai_client, mock_thread):
        """Testa geração de resumo (Async)."""

        def side_effect(target, args):
            target(*args)
            return MagicMock()
        mock_thread.side_effect = side_effect

        mock_assembler.return_value = "Texto longo."
        mock_search_context.return_value = ([], [])

        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = None
        mock_response.text = '{"summary": "Resumo gerado", "key_points": ["P1"]}'

        mock_client_instance.models.generate_content.return_value = mock_response
        mock_genai_client.return_value = mock_client_instance

        payload = {
            "chat": self.chat.id,
            "type": "SUMMARY",
            "title": "My Summary"
        }

        response = self.client.post('/api/v1/studio/artifacts/', payload, format='json')

        artifact = KnowledgeArtifact.objects.get(title="My Summary")
        self.assertEqual(artifact.content['summary'], "Resumo gerado")
