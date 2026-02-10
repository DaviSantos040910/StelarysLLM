from django.test import TestCase
from django.template.loader import render_to_string
from studio.models import KnowledgeArtifact
from datetime import datetime

class PDFRenderingTest(TestCase):
    def setUp(self):
        self.artifact = KnowledgeArtifact(
            title="Test Artifact",
            type=KnowledgeArtifact.ArtifactType.QUIZ,
            created_at=datetime.now()
        )

    def test_quiz_rendering(self):
        content = [
            {
                "question": "Q1",
                "options": ["A", "B"],
                "correctAnswerIndex": 0
            }
        ]
        html = render_to_string('pdf/pdf_quiz.html', {'artifact': self.artifact, 'content': content})
        self.assertIn("Test Artifact", html)
        self.assertIn("Q1", html)
        self.assertIn("Gabarito", html)

    def test_flashcard_rendering(self):
        self.artifact.type = KnowledgeArtifact.ArtifactType.FLASHCARD
        content = [
            {"front": "Term", "back": "Definition"}
        ]
        html = render_to_string('pdf/pdf_flashcards.html', {'artifact': self.artifact, 'content': content})
        self.assertIn("card-grid", html)
        self.assertIn("Term", html)

    def test_summary_rendering(self):
        self.artifact.type = KnowledgeArtifact.ArtifactType.SUMMARY
        content = {"summary": "This is a summary."}
        html = render_to_string('pdf/pdf_summary.html', {'artifact': self.artifact, 'content': content})
        self.assertIn("This is a summary.", html)
