import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import GuestSession, User
from bots.models import Bot
from studio.models import StudySpace, KnowledgeSource
from chat.models import Chat
from explore.models import SearchHistory

class GuestDataIsolationTests(TestCase):
    def setUp(self):
        self.guest1_id = str(uuid.uuid4())
        self.guest2_id = str(uuid.uuid4())
        self.user_credentials = {"username": "testuser", "password": "password123"}
        self.user = User.objects.create_user(**self.user_credentials)

        self.client_g1 = APIClient()
        self.client_g1.credentials(HTTP_X_GUEST_ID=self.guest1_id)

        self.client_g2 = APIClient()
        self.client_g2.credentials(HTTP_X_GUEST_ID=self.guest2_id)

        self.client_user = APIClient()
        self.client_user.force_authenticate(user=self.user)

    def get_results(self, response_data):
        """Helper to handle paginated or list responses."""
        if isinstance(response_data, dict) and 'results' in response_data:
            return response_data['results']
        if isinstance(response_data, list):
            return response_data
        return []

    def test_bot_isolation(self):
        # Guest 1 creates a bot
        res = self.client_g1.post('/api/v1/bots/', {
            "name": "Bot G1", "prompt": "Hi", "voice": "energetic_youth", "publicity": "Guests"
        })
        self.assertEqual(res.status_code, 201)
        bot_id = res.data['id']

        # Guest 2 should not see it in "created by me" (BotListCreateView)
        res_g2 = self.client_g2.get('/api/v1/bots/')
        self.assertEqual(res_g2.status_code, 200)
        results_g2 = self.get_results(res_g2.data)
        self.assertEqual(len(results_g2), 0)

        # User should not see it
        res_u = self.client_user.get('/api/v1/bots/')
        self.assertEqual(res_u.status_code, 200)
        results_u = self.get_results(res_u.data)
        self.assertEqual(len(results_u), 0)

        # Guest 1 should see it
        res_g1 = self.client_g1.get('/api/v1/bots/')
        results_g1 = self.get_results(res_g1.data)
        self.assertEqual(len(results_g1), 1)
        self.assertEqual(results_g1[0]['id'], bot_id)

    def test_studyspace_isolation(self):
        # Guest 1 creates space
        res = self.client_g1.post('/api/v1/studio/spaces/', {"title": "Space G1", "description": "Desc"})
        self.assertEqual(res.status_code, 201)
        space_id = res.data['id']

        # Guest 2 checks spaces
        res_g2 = self.client_g2.get('/api/v1/studio/spaces/')
        results_g2 = self.get_results(res_g2.data)
        self.assertEqual(len(results_g2), 0)

        # Guest 1 checks
        res_g1 = self.client_g1.get('/api/v1/studio/spaces/')
        results_g1 = self.get_results(res_g1.data)
        self.assertEqual(len(results_g1), 1)
        self.assertEqual(results_g1[0]['id'], space_id)

    def test_search_history_isolation(self):
        # Guest 1 searches
        self.client_g1.post('/api/v1/explore/history/', {"term": "python"})

        # Guest 2 searches something else
        self.client_g2.post('/api/v1/explore/history/', {"term": "django"})

        # Guest 1 history
        res_g1 = self.client_g1.get('/api/v1/explore/history/')
        results_g1 = self.get_results(res_g1.data)
        self.assertEqual(len(results_g1), 1)
        self.assertEqual(results_g1[0]['term'], "python")

        # Guest 2 history
        res_g2 = self.client_g2.get('/api/v1/explore/history/')
        results_g2 = self.get_results(res_g2.data)
        self.assertEqual(len(results_g2), 1)
        self.assertEqual(results_g2[0]['term'], "django")

    def test_chat_creation_and_retrieval(self):
        # Create a public bot first (admin or user owned)
        bot = Bot.objects.create(owner=self.user, name="Public Bot", prompt="Hi", publicity="Public")

        # Guest 1 bootstraps chat
        # Fixed URL: /api/v1/chats/bootstrap/bot/<id>/
        res = self.client_g1.get(f'/api/v1/chats/bootstrap/bot/{bot.id}/')
        if res.status_code != 200:
            print(f"Chat bootstrap failed: {res.status_code} {res.data}")
        self.assertEqual(res.status_code, 200)
        chat_id_g1 = res.data['conversationId']

        # Guest 2 bootstraps chat (should be new)
        res2 = self.client_g2.get(f'/api/v1/chats/bootstrap/bot/{bot.id}/')
        self.assertEqual(res2.status_code, 200)
        chat_id_g2 = res2.data['conversationId']

        self.assertNotEqual(chat_id_g1, chat_id_g2)

        # Verify ownership in DB
        c1 = Chat.objects.get(id=chat_id_g1)
        c2 = Chat.objects.get(id=chat_id_g2)

        self.assertEqual(str(c1.guest_session.id), self.guest1_id)
        self.assertEqual(str(c2.guest_session.id), self.guest2_id)
