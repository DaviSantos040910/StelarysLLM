from django.test import TestCase
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from chat.models import Chat
from bots.models import Bot
from studio.models import KnowledgeArtifact
from studio.schemas import QUIZ_SCHEMA
from studio.views import KnowledgeArtifactViewSet # Import for manual testing
import json

User = get_user_model()

class ArtifactGenerationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create(username="testuser")
        self.client.force_authenticate(user=self.user)
        self.bot = Bot.objects.create(name="TestBot", owner=self.user, prompt="You are a funny teacher.")
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
            "config": { # Corrected payload structure based on previous errors/logs if any, or standard
                "selectedSourceIds": [1, 2]
            }
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

    @patch('studio.views.get_ai_client')
    @patch('studio.views.get_model')
    @patch('studio.services.source_assembler.SourceAssemblyService.get_context_from_config')
    def test_generate_artifact_with_personality(self, mock_assembler, mock_get_model, mock_get_ai_client):
        """Testa se a personalidade do bot é incluída no prompt de geração."""
        
        # Setup Mocks
        mock_assembler.return_value = "Context content."
        mock_get_model.return_value = 'gemini-2.5-flash'
        
        mock_client = MagicMock()
        mock_get_ai_client.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.parsed = {"summary": "Content"}
        mock_client.models.generate_content.return_value = mock_response

        # Create Artifact (DB entry)
        artifact = KnowledgeArtifact.objects.create(
            chat=self.chat,
            type="SUMMARY",
            title="Personality Test",
            status="processing"
        )

        # Manually call _generate_content_with_ai to avoid threading complexity in this specific test
        view = KnowledgeArtifactViewSet()
        
        # Options matching what perform_create extracts
        options = {
            'quantity': 5,
            'difficulty': 'Medium',
            'source_ids': [],
            'custom_instructions': None,
            'target_duration': None,
            'includeChatHistory': False
        }

        # Execute Generation Logic
        view._generate_content_with_ai(artifact.id, options)

        # Verify AI Call
        mock_client.models.generate_content.assert_called_once()
        _, kwargs = mock_client.models.generate_content.call_args
        
        # Check System Instruction for Personality
        config = kwargs.get('config')
        self.assertIsNotNone(config)
        system_instruction = config.system_instruction
        
        # Bot prompt was "You are a funny teacher."
        self.assertIn("You are a funny teacher.", system_instruction)
        self.assertIn("YOUR PERSONALITY/ROLE:", system_instruction)
        self.assertIn("STRICTLY use the provided Context Material", system_instruction)
