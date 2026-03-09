from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from unittest.mock import patch, MagicMock
from bots.models import Bot
from chat.models import Chat
from studio.models import KnowledgeArtifact
from chat.services.content_extractor import ContentExtractor

User = get_user_model()

class StudioIntegrationTests(APITestCase):
    def setUp(self):
        # Create User, Bot, and Chat
        self.user = User.objects.create_user(username='testuser', password='password')
        self.bot = Bot.objects.create(name="Test Bot", allow_web_search=False, owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/v1/studio/artifacts/'

    @patch('chat.services.content_extractor.ContentExtractor.extract_from_youtube')
    @patch('chat.services.content_extractor.ContentExtractor.is_youtube_url')
    def test_superclip_youtube_integration(self, mock_is_youtube, mock_extract):
        """
        Teste 1: Teste de Integração do SuperClip (Mockado)
        Simula o fluxo onde uma URL do YouTube seria processada.
        Nota: O processamento real do artefato (geração de conteúdo) acontece assincronamente na prática,
        mas aqui validamos que o sistema de extração pode ser chamado e um artefato placeholder pode ser criado.
        """
        mock_is_youtube.return_value = True
        mock_extract.return_value = "Texto transcrito do YouTube mockado."

        youtube_url = "https://www.youtube.com/watch?v=mockvideo"

        # Simula a lógica que aconteceria no View/Service ao receber essa URL:
        # 1. Detectar URL
        self.assertTrue(ContentExtractor.is_youtube_url(youtube_url))

        # 2. Extrair Conteúdo
        content = ContentExtractor.extract_from_youtube(youtube_url)
        self.assertEqual(content, "Texto transcrito do YouTube mockado.")

        # 3. Criar Artefato com status PROCESSING (Simulando o que a view de chat faria)
        artifact = KnowledgeArtifact.objects.create(
            chat=self.chat,
            type=KnowledgeArtifact.ArtifactType.SUMMARY,
            title="Resumo do Vídeo",
            status=KnowledgeArtifact.Status.PROCESSING,
            media_url=youtube_url
        )

        self.assertEqual(artifact.status, 'processing')
        self.assertEqual(artifact.media_url, youtube_url)

    def test_studio_structure_json(self):
        """
        Teste 2: Teste de Estrutura do Estúdio
        Garante que o JSON é salvo e recuperado corretamente.
        """
        quiz_content = [
            {
                "question": "Quanto é 2+2?",
                "options": ["3", "4", "5"],
                "correctAnswerIndex": 1
            }
        ]

        # Criação via API
        data = {
            'chat': self.chat.id,
            'type': 'QUIZ',
            'title': 'Math Quiz',
            'content': quiz_content
        }

        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        artifact_id = response.data['id']

        # Recuperação via API
        response_get = self.client.get(f"{self.url}{artifact_id}/")
        self.assertEqual(response_get.status_code, status.HTTP_200_OK)

        # Verifica se o content voltou como lista (JSON parseado), não string
        self.assertIsInstance(response_get.data['content'], list)
        self.assertEqual(response_get.data['content'][0]['question'], "Quanto é 2+2?")

    def test_invalid_artifact_type(self):
        """
        Teste 3: Teste de Erro com Tipo Inválido
        """
        data = {
            'chat': self.chat.id,
            'type': 'UNKNOWN_TYPE', # Inválido
            'title': 'Fail',
            'content': []
        }

        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('type', response.data)

    def test_study_space_crud(self):
        """
        Teste 4: CRUD de Espaços de Estudo
        """
        url = '/api/v1/studio/spaces/'
        data = {
            'title': 'My Space',
            'description': 'A nice place'
        }

        # Create
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'My Space')
        space_id = response.data['id']

        # List
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        # Retrieve
        response = self.client.get(f"{url}{space_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'My Space')
