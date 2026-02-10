from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.strict_style_service import strict_style_service

class StrictStyleServiceTest(TestCase):
    def setUp(self):
        self.service = strict_style_service

    def test_validate_rewrite_success(self):
        """Test valid rewrites pass validation."""
        base = 'Não encontrei "banana" nas fontes.'
        output = 'Olá, infelizmente não vi nada sobre "banana" nos documentos.'

        # Should pass: quotes preserved, no new numbers/urls, length ok
        self.assertTrue(self.service._validate_rewrite(base, output, quoted_spans=['banana']))

    def test_validate_rewrite_fail_missing_quote(self):
        """Test validation fails if quotes are missing."""
        base = 'Não encontrei "banana".'
        output = 'Não encontrei a fruta.' # Missing "banana"

        self.assertFalse(self.service._validate_rewrite(base, output, quoted_spans=['banana']))

    def test_validate_rewrite_fail_new_numbers(self):
        """Test validation fails if new relevant numbers appear."""
        base = 'Não ha dados.'
        output = 'Não ha dados de 2024.' # New number

        self.assertFalse(self.service._validate_rewrite(base, output))

    def test_validate_rewrite_fail_forbidden_terms(self):
        """Test validation fails if forbidden web terms appear."""
        base = 'Não sei.'
        output = 'Pesquisei na internet e não sei.'

        self.assertFalse(self.service._validate_rewrite(base, output))

    def test_validate_rewrite_fail_length(self):
        """Test validation fails if output is too long."""
        base = 'Oi'
        output = 'Oi ' + 'a'*200

        self.assertFalse(self.service._validate_rewrite(base, output))

    def test_validate_rewrite_sources_success(self):
        """Test validation for source lists."""
        base = "Docs: A.pdf, B.pdf"
        output = "Temos: A.pdf e também B.pdf"
        sources = ["A.pdf", "B.pdf"]

        self.assertTrue(self.service._validate_rewrite(base, output, allowed_doc_titles=sources))

    def test_validate_rewrite_sources_fail_missing(self):
        """Test validation fails if a source is dropped."""
        base = "Docs: A.pdf, B.pdf"
        output = "Temos: A.pdf" # Missing B.pdf
        sources = ["A.pdf", "B.pdf"]

        self.assertFalse(self.service._validate_rewrite(base, output, allowed_doc_titles=sources))

    @patch('chat.services.strict_style_service.strict_style_service.client')
    def test_rewrite_fallback_on_failure(self, mock_client):
        """Test fallback to base text when LLM fails or validation fails."""
        # Mock LLM returning invalid text (with URL)
        mock_response = MagicMock()
        mock_response.text = "Here is a link: http://google.com"
        mock_client.models.generate_content.return_value = mock_response

        base = "No info."
        result = self.service.rewrite_strict_refusal(base, "Persona", "Bot", "en")

        # Should return base because URL validation failed
        self.assertEqual(result, base)
