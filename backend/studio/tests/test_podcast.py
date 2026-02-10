from django.test import TestCase
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from chat.models import Chat
from bots.models import Bot
from studio.models import KnowledgeArtifact
import unittest.mock

User = get_user_model()

class PodcastGenerationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create(username="testuser")
        self.client.force_authenticate(user=self.user)
        self.bot = Bot.objects.create(name="TestBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    @patch('studio.views.threading.Thread')
    @patch('studio.views.AudioMixerService.mix_podcast')
    @patch('studio.views.PodcastScriptingService.generate_script')
    @patch('studio.services.source_assembler.SourceAssemblyService.get_context_from_config')
    def test_generate_podcast_success(self, mock_assembler, mock_scripting, mock_mixer, mock_thread):
        """Testa o fluxo completo de geração de Podcast (Roteiro -> Áudio)."""

        # Simula execução síncrona do thread
        def side_effect(target, args):
            target(*args)
            return MagicMock()
        mock_thread.side_effect = side_effect

        # Mocks
        mock_assembler.return_value = "Conteúdo do podcast."

        mock_scripting.return_value = [
            {"speaker": "Host (Alex)", "text": "Welcome!"},
            {"speaker": "Guest (Jamie)", "text": "Hi!"}
        ]

        mock_mixer.return_value = "podcasts/test_mix.mp3"

        payload = {
            "chat": self.chat.id,
            "type": "PODCAST",
            "title": "My Podcast",
            "duration": "Short"
        }

        response = self.client.post('/api/v1/studio/artifacts/', payload, format='json')

        # Verificações
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        artifact = KnowledgeArtifact.objects.get(title="My Podcast")
        self.assertEqual(artifact.status, KnowledgeArtifact.Status.READY)
        self.assertEqual(artifact.media_url, "/media/podcasts/test_mix.mp3")
        self.assertEqual(len(artifact.content), 2)

        # Verifica chamadas
        mock_scripting.assert_called_once_with(
            title="My Podcast",
            context="Conteúdo do podcast.",
            duration_constraint="Short"
        )
        mock_mixer.assert_called_once()

    @patch('studio.services.audio_mixer.generate_tts_audio')
    @patch('studio.services.audio_mixer.AudioSegment')
    @patch('studio.services.audio_mixer.os.makedirs')
    def test_audio_mixer_service(self, mock_makedirs, mock_audio_segment, mock_tts):
        """Testa o serviço de mixagem isoladamente com paralelismo."""
        from studio.services.audio_mixer import AudioMixerService

        script = [
            {"speaker": "Host (Alex)", "text": "Hello"},
            {"speaker": "Guest (Jamie)", "text": "World"}
        ]

        mock_tts.return_value = {'success': True, 'file_path': 'dummy.wav'}

        mock_segment_instance = MagicMock()
        mock_audio_segment.from_wav.return_value = mock_segment_instance
        mock_audio_segment.empty.return_value = mock_segment_instance
        mock_audio_segment.silent.return_value = mock_segment_instance

        mock_segment_instance.__add__.return_value = mock_segment_instance
        mock_segment_instance.__iadd__.return_value = mock_segment_instance

        path = AudioMixerService.mix_podcast(script)

        self.assertTrue(path.startswith("podcasts/podcast_mix_"))
        self.assertTrue(path.endswith(".mp3"))

        self.assertEqual(mock_tts.call_count, 2)
        mock_segment_instance.export.assert_called_once()
