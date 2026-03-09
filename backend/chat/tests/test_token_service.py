from django.test import SimpleTestCase
from chat.services.token_service import TokenService

class TokenServiceTest(SimpleTestCase):
    def test_estimate_tokens(self):
        text = "1234" # 4 chars
        self.assertEqual(TokenService.estimate_tokens(text), 1)

        text = "12345678" # 8 chars
        self.assertEqual(TokenService.estimate_tokens(text), 2)

        self.assertEqual(TokenService.estimate_tokens(""), 0)

    def test_truncate_to_token_limit(self):
        # 40 chars = 10 tokens
        text = "a" * 40

        # Limit 5 tokens (20 chars)
        truncated = TokenService.truncate_to_token_limit(text, 5)

        self.assertIn("TRUNCATED", truncated)
        # Should start with roughly 20 chars
        self.assertTrue(truncated.startswith("aaaa"))

        # Ensure it is indeed truncated (prefix matches original)
        self.assertEqual(truncated[:20], text[:20])

    def test_no_truncate_if_under_limit(self):
        text = "a" * 20 # 5 tokens
        truncated = TokenService.truncate_to_token_limit(text, 10)
        self.assertEqual(text, truncated)
