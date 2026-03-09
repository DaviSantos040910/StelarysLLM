from django.test import TestCase
from unittest.mock import patch, MagicMock
from chat.services.chat_service import _calculate_metrics, _save_metrics
from chat.models import ChatMessage, Chat, ChatResponseMetric
from bots.models import Bot
from django.contrib.auth import get_user_model

User = get_user_model()

class MetricsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.bot = Bot.objects.create(name="TestBot", owner=self.user)
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)
        self.message = ChatMessage.objects.create(
            chat=self.chat,
            role='assistant',
            content="Response text"
        )

    def test_calculate_metrics_with_citations(self):
        """Testa cálculo de métricas quando há citações explícitas."""
        response_text = "De acordo com file1.pdf, isso é verdade."
        context_sources = ["file1.pdf", "file2.docx"]

        metrics = _calculate_metrics(response_text, context_sources)

        self.assertEqual(metrics['sources_count'], 2)
        self.assertEqual(metrics['cited_count'], 1)
        self.assertTrue(metrics['has_citation'])

    def test_calculate_metrics_no_citations(self):
        """Testa cálculo quando não há citações."""
        response_text = "Resposta genérica sem fontes."
        context_sources = ["file1.pdf"]

        metrics = _calculate_metrics(response_text, context_sources)

        self.assertEqual(metrics['cited_count'], 0)
        self.assertFalse(metrics['has_citation'])

    def test_save_metrics(self):
        """Testa salvamento no banco."""
        metrics = {'sources_count': 5, 'cited_count': 2, 'has_citation': True}

        _save_metrics(self.message, metrics)

        saved = ChatResponseMetric.objects.get(message=self.message)
        self.assertEqual(saved.sources_count, 5)
        self.assertEqual(saved.cited_count, 2)
        self.assertTrue(saved.has_citation)
