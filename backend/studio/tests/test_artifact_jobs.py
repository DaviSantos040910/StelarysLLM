from django.test import TestCase
from unittest.mock import patch, MagicMock
from studio.models import KnowledgeArtifact
from studio.jobs.artifact_jobs import generate_artifact_job
from chat.models import Chat, Bot
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()

class ArtifactJobTest(TestCase):
    def setUp(self):
        # Create user
        self.user = User.objects.create(email="test@example.com", username="testuser")
        # Create bot (requires name and owner)
        self.bot = Bot.objects.create(name="Test Bot", owner=self.user)
        # Create chat
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)
        # Create artifact
        self.artifact = KnowledgeArtifact.objects.create(
            chat=self.chat,
            type=KnowledgeArtifact.ArtifactType.QUIZ,
            title="Test Quiz",
            status=KnowledgeArtifact.Status.PROCESSING,
            stage=KnowledgeArtifact.Stage.QUEUED,
            correlation_id=uuid.uuid4()
        )
        self.options = {
            'quantity': 5,
            'difficulty': 'Easy'
        }

    @patch('studio.jobs.artifact_jobs.SourceAssemblyService.get_context_from_config')
    @patch('studio.jobs.artifact_jobs.get_ai_client')
    def test_generate_standard_artifact_success(self, mock_get_client, mock_get_context):
        # Setup Mocks
        mock_get_context.return_value = "Test Context"

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_response = MagicMock()
        mock_response.parsed = {"questions": []}
        mock_client.models.generate_content.return_value = mock_response

        # Execute Job
        generate_artifact_job(self.artifact.id, self.options)

        # Assertions
        self.artifact.refresh_from_db()
        self.assertEqual(self.artifact.status, KnowledgeArtifact.Status.READY)
        self.assertEqual(self.artifact.stage, KnowledgeArtifact.Stage.READY)
        self.assertIsNotNone(self.artifact.finished_at)
        self.assertEqual(self.artifact.content, {"questions": []})
        self.assertEqual(self.artifact.attempts, 1)

    @patch('studio.jobs.artifact_jobs.SourceAssemblyService.get_context_from_config')
    def test_generate_artifact_failure(self, mock_get_context):
        # Setup Failure
        mock_get_context.side_effect = Exception("Context Error")

        # Execute Job
        with self.assertRaises(Exception):
            generate_artifact_job(self.artifact.id, self.options)

        # Assertions
        self.artifact.refresh_from_db()
        self.assertEqual(self.artifact.status, KnowledgeArtifact.Status.ERROR)
        self.assertEqual(self.artifact.stage, KnowledgeArtifact.Stage.ERROR)
        self.assertIn("Context Error", self.artifact.error_message)
        self.assertIsNotNone(self.artifact.finished_at)

    @patch('studio.jobs.artifact_jobs.SourceAssemblyService.get_context_from_config')
    @patch('studio.jobs.artifact_jobs.PodcastScriptingService.generate_script')
    @patch('studio.jobs.artifact_jobs.AudioMixerService.mix_podcast')
    def test_generate_podcast_success(self, mock_mix, mock_script, mock_get_context):
        # Setup Podcast Artifact
        self.artifact.type = KnowledgeArtifact.ArtifactType.PODCAST
        self.artifact.save()

        mock_get_context.return_value = "Context"
        mock_script.return_value = [{"speaker": "Host", "text": "Hello"}]
        mock_mix.return_value = "podcast.mp3"

        # Execute
        generate_artifact_job(self.artifact.id, self.options)

        # Assertions
        self.artifact.refresh_from_db()
        self.assertEqual(self.artifact.status, KnowledgeArtifact.Status.READY)
        self.assertEqual(self.artifact.media_url, "/media/podcast.mp3")
        self.assertEqual(self.artifact.content, [{"speaker": "Host", "text": "Hello"}])

    @patch('studio.jobs.artifact_jobs.SourceAssemblyService.get_context_from_config')
    @patch('studio.jobs.artifact_jobs.get_ai_client')
    def test_prompt_structure_contains_fact_policy(self, mock_get_client, mock_get_context):
        # Setup
        mock_get_context.return_value = "Test Context Source"
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock successful response
        mock_response = MagicMock()
        mock_response.parsed = {"questions": []}
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        generate_artifact_job(self.artifact.id, self.options)

        # Assertions
        # Check that generate_content was called with a config containing the strict policy
        call_args = mock_client.models.generate_content.call_args
        self.assertIsNotNone(call_args)

        # Args: (model=..., contents=..., config=...)
        # kwargs usually has 'config'
        config_arg = call_args.kwargs.get('config')
        system_instruction = config_arg.system_instruction

        self.assertIn("FACT POLICY (STRICT RULES):", system_instruction)
        self.assertIn("USE ONLY THE PROVIDED CONTEXT MATERIAL FOR FACTS", system_instruction)
        self.assertIn("Test Context Source", system_instruction)

    @patch('studio.jobs.artifact_jobs.SourceAssemblyService.get_context_from_config')
    @patch('studio.jobs.artifact_jobs.get_ai_client')
    @patch('studio.jobs.artifact_jobs.time.sleep') # Mock sleep to speed up test
    def test_json_retry_logic(self, mock_sleep, mock_get_client, mock_get_context):
        # Setup
        mock_get_context.return_value = "Ctx"
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock 1st failure (malformed JSON), 2nd success
        fail_response = MagicMock()
        fail_response.parsed = None
        fail_response.text = "Invalid JSON"

        success_response = MagicMock()
        success_response.parsed = {"success": True}

        # Side effect for generate_content
        mock_client.models.generate_content.side_effect = [fail_response, success_response]

        # Execute
        generate_artifact_job(self.artifact.id, self.options)

        # Assertions
        self.artifact.refresh_from_db()
        self.assertEqual(self.artifact.status, KnowledgeArtifact.Status.READY)
        self.assertEqual(self.artifact.content, {"success": True})

        # Verify it was called twice
        self.assertEqual(mock_client.models.generate_content.call_count, 2)
