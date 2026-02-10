# chat/tests/test_stream_logic.py
from django.test import TestCase
from unittest.mock import MagicMock, patch
from chat.services.chat_service import process_message_stream
from chat.models import Chat, Bot, ChatMessage
from django.contrib.auth import get_user_model
import json
import re

User = get_user_model()

class StreamLogicTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="stream_user")
        self.bot = Bot.objects.create(
            name="StreamBot",
            owner=self.user,
            strict_context=True,
            allow_web_search=False
        )
        self.chat = Chat.objects.create(user=self.user, bot=self.bot)

    def _consume_stream(self, generator):
        """Helper to consume SSE generator and return list of json payloads"""
        messages = []
        for event in generator:
            if event.startswith("data: "):
                try:
                    payload = json.loads(event[6:])
                    messages.append(payload)
                except json.JSONDecodeError:
                    pass
        return messages

    # Patch CLASS method to affect all instances (chat_service and strict_boundary)
    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_strict_on_no_context(self, mock_get_client, mock_get_docs, mock_search):
        """
        1. Strict ON + No Context
        Expected:
        - No call to generate_content or generate_content_stream (ZERO CALLS)
        - Immediate refusal (helper)
        - Message saved as refusal
        - SSE 'end' event with real ID
        """
        self.bot.strict_context = True
        self.bot.save()

        # Mock: No context found
        mock_search.return_value = ([], [])
        # Mock: Docs exist but search returned nothing -> Strict refusal
        mock_get_docs.return_value = [{'source': 'Doc1.pdf'}]

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Execute (Use PT question to trigger PT refusal)
        stream = process_message_stream(self.user.id, self.chat.id, "Qual a cor?")
        events = self._consume_stream(stream)

        # Verify
        # Should start
        self.assertEqual(events[0]['type'], 'start')

        # Should NOT call generate_content (ZERO CALLS)
        self.assertEqual(mock_client.models.generate_content.call_count, 0)
        self.assertFalse(mock_client.models.generate_content_stream.called)

        # Check end event
        end_event = events[-1]
        self.assertEqual(end_event['type'], 'end')
        self.assertNotEqual(end_event['message_id'], 0) # Must have real ID
        # "Qual" triggers PT detection
        self.assertIn("Não encontrei essa informação", end_event['clean_content'])

        # Verify DB
        msg = ChatMessage.objects.get(id=end_event['message_id'])
        self.assertIn("Não encontrei essa informação", msg.content)
        self.assertEqual(msg.role, 'assistant')

    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_strict_on_context_valid_citation(self, mock_get_client, mock_get_docs, mock_search):
        """
        2. Strict ON + Context + Valid Citation
        Expected:
        - Call generate_content (SYNC)
        - Validate citation [1]
        - Pseudo-stream chunks
        - Save correct content
        """
        self.bot.strict_context = True
        self.bot.save()

        # Mock: Context found with GOOD score to pass EvidenceGate
        mock_search.return_value = ([{'content': 'Fact', 'source': 'Doc1.pdf', 'source_id': '1', 'score': 0.1}], [])
        mock_get_docs.return_value = [{'source': 'Doc1.pdf'}]

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock Sync Response (Valid)
        response_valid = MagicMock()
        response_valid.text = "This is a fact [1]."
        mock_client.models.generate_content.return_value = response_valid

        # Execute
        stream = process_message_stream(self.user.id, self.chat.id, "Question?")
        events = self._consume_stream(stream)

        # Verify
        # Should call SYNC generate_content (not stream)
        self.assertTrue(mock_client.models.generate_content.called)

        # Check Chunks (Pseudo-stream)
        chunk_events = [e for e in events if e['type'] == 'chunk']
        self.assertTrue(len(chunk_events) > 0)
        full_text = "".join([e['text'] for e in chunk_events])
        self.assertEqual(full_text, "This is a fact [1].")

        # Check End Event
        end_event = events[-1]
        self.assertEqual(end_event['type'], 'end')
        self.assertEqual(end_event['clean_content'], "This is a fact [1].")

        # Check Sources in End Event (should be populated)
        self.assertTrue(len(end_event['sources']) > 0)
        self.assertEqual(end_event['sources'][0]['id'], '1')

    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.get_ai_client')
    def test_strict_on_context_no_citation(self, mock_get_client, mock_get_docs, mock_search):
        """
        3. Strict ON + Context + NO Citation (Hallucination)
        Expected:
        - Call generate_content (SYNC) ONCE (for the hallucination)
        - Detect missing citation
        - FALLBACK to deterministic refusal (ZERO calls for refusal)
        - Pseudo-stream refusal
        - Save refusal
        """
        self.bot.strict_context = True
        self.bot.save()

        # Mock: Context found with GOOD score
        mock_search.return_value = ([{'content': 'Fact', 'source': 'Doc1.pdf', 'source_id': '1', 'score': 0.1}], [])
        mock_get_docs.return_value = [{'source': 'Doc1.pdf'}]

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock Sync Response (Invalid - No Citation)
        response_hallucination = MagicMock()
        response_hallucination.text = "This is a fact without citation."

        # We only set ONE return value because the refusal is now deterministic
        mock_client.models.generate_content.return_value = response_hallucination

        # Execute
        stream = process_message_stream(self.user.id, self.chat.id, "Question?")
        events = self._consume_stream(stream)

        # Verify
        # Should call SYNC ONCE
        self.assertEqual(mock_client.models.generate_content.call_count, 1)

        # Check Chunks (Pseudo-stream of REFUSAL)
        chunk_events = [e for e in events if e['type'] == 'chunk']
        full_text = "".join([e['text'] for e in chunk_events])

        # Refusal text should be in English (default) as "Question?" is ambiguous/EN
        self.assertIn("I couldn’t find this information", full_text)

        # Check End Event
        end_event = events[-1]
        self.assertIn("I couldn’t find this information", end_event['clean_content'])
        self.assertEqual(end_event['sources'], []) # No sources for refusal

    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.generate_content_stream')
    @patch('chat.services.chat_service.get_ai_client')
    def test_strict_off_real_stream(self, mock_get_client, mock_generate_stream, mock_get_docs, mock_search):
        """
        4. Strict OFF (Normal)
        Expected:
        - Call generate_content_stream (REAL STREAM)
        - Handle chunks
        """
        self.bot.strict_context = False
        self.bot.save()

        # Mock: No context (or context, doesn't matter much for flow choice)
        mock_search.return_value = ([], [])
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock Stream
        mock_stream_iterator = iter(["Chunk 1", "Chunk 2"])
        mock_generate_stream.return_value = mock_stream_iterator

        # Execute
        stream = process_message_stream(self.user.id, self.chat.id, "Question?")
        events = self._consume_stream(stream)

        # Verify
        self.assertTrue(mock_generate_stream.called)

        chunk_events = [e for e in events if e['type'] == 'chunk']
        full_text = "".join([e['text'] for e in chunk_events])
        self.assertEqual(full_text, "Chunk 1Chunk 2")

    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.generate_content_stream')
    @patch('chat.services.chat_service.get_ai_client')
    def test_suggestions_parsing_safe(self, mock_get_client, mock_generate_stream, mock_get_docs, mock_search):
        """
        5. Suggestion Parsing Safety
        - Only parse if valid (e.g. at end after marker).
        - If invalid, treat as text.
        """
        self.bot.strict_context = False
        self.bot.save()

        mock_search.return_value = ([], [])
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Case A: VALID suggestions (after \n\n---\n)
        # Note: We need to simulate chunks coming in such that logic triggers
        # Let's assume the full content buffer accumulates correctly
        mock_stream_iterator = iter(["Context \n\n---\n", "|||SUGGESTIONS|||", '["Sug1"]'])
        mock_generate_stream.return_value = mock_stream_iterator

        stream = process_message_stream(self.user.id, self.chat.id, "Q")
        events = self._consume_stream(stream)

        end_event = events[-1]
        self.assertEqual(end_event['suggestions'], ['Sug1'])
        self.assertIn("Context", end_event['clean_content'])

    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.generate_content_stream')
    @patch('chat.services.chat_service.get_ai_client')
    def test_suggestions_parsing_valid_trust(self, mock_get_client, mock_generate_stream, mock_get_docs, mock_search):
        """
        6. Suggestion Parsing Safety (Trust Unique Token)
        - If unique separator is found, we assume it is valid and consume suggestions.
        - Previous 'invalid' test is removed/updated because we now TRUST the token.
        """
        self.bot.strict_context = False
        self.bot.save()
        mock_search.return_value = ([], [])
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Case B: Token found -> Should parse suggestions
        # Even if not preceded by ---, we trust the model outputting the specific token
        mock_stream_iterator = iter(["Some text ", "|||SUGGESTIONS|||", '["Sug1"]'])
        mock_generate_stream.return_value = mock_stream_iterator

        stream = process_message_stream(self.user.id, self.chat.id, "Q")
        events = self._consume_stream(stream)

        end_event = events[-1]
        self.assertEqual(end_event['suggestions'], ['Sug1'])
        self.assertEqual(end_event['clean_content'], "Some text ")

    @patch('chat.vector_service.VectorService.search_context')
    @patch('chat.vector_service.VectorService.get_available_documents')
    @patch('chat.services.chat_service.generate_content_stream')
    @patch('chat.services.chat_service.get_ai_client')
    def test_mixed_mode_disclaimer(self, mock_get_client, mock_generate_stream, mock_get_docs, mock_search):
        """
        7. Mixed Mode Disclaimer (Strict OFF + Web ON + No Context)
        Expected:
        - Stream answer
        - Append disclaimer at the end
        """
        self.bot.strict_context = False
        self.bot.allow_web_search = True
        self.bot.save()

        # No context
        mock_search.return_value = ([], [])
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Stream standard answer
        mock_stream_iterator = iter(["This is a ", "web answer."])
        mock_generate_stream.return_value = mock_stream_iterator

        stream = process_message_stream(self.user.id, self.chat.id, "Q")
        events = self._consume_stream(stream)

        end_event = events[-1]
        self.assertIn("Nota sobre fontes", end_event['clean_content'])
        self.assertIn("This is a web answer.", end_event['clean_content'])

        # Check that disclaimer chunk was sent
        chunks = [e['text'] for e in events if e['type'] == 'chunk']
        full_text = "".join(chunks)
        self.assertIn("Nota sobre fontes", full_text)
