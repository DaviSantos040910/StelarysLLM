import logging

logger = logging.getLogger(__name__)

class TokenService:
    """
    Simple heuristic-based token estimation service.
    For production with strict limits, consider using tiktoken or similar,
    but for Gemini 1M+ context, rough char count is sufficient and faster.
    """

    CHARS_PER_TOKEN = 4

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Estimates token count based on character length."""
        if not text:
            return 0
        return len(text) // TokenService.CHARS_PER_TOKEN

    @staticmethod
    def truncate_to_token_limit(text: str, limit: int) -> str:
        """
        Truncates text to approximate token limit.
        Returns the truncated text.
        """
        if not text:
            return ""

        estimated = TokenService.estimate_tokens(text)
        if estimated <= limit:
            return text

        # Calculate char limit
        char_limit = limit * TokenService.CHARS_PER_TOKEN

        logger.warning(f"Truncating text from {estimated} tokens to {limit} tokens.")
        return text[:char_limit] + "\n...[TRUNCATED DUE TO CONTEXT LIMIT]..."
