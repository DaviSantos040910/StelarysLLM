# bots/views.py
from rest_framework import generics, permissions, status, parsers
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Bot
from .serializers import BotSerializer, BotDetailSerializer
from chat.services import generate_suggestions_for_bot

class BotListCreateView(generics.ListCreateAPIView):
    """
    API view for listing user's CREATED bots and creating new ones.
    """
    serializer_class = BotSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        return Bot.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # --- CORREÇÃO APLICADA AQUI ---
        # 1. First, we save the bot and assign the owner, as before.
        bot = serializer.save(owner=self.request.user)

        # 2. Then, we automatically add the owner to the subscribers list.
        # This ensures the created bot appears on the user's "My Bots" screen.
        bot.subscribers.add(self.request.user)
        # --- NOVA LÓGICA: Gerar e guardar as sugestões ---
        suggestions = generate_suggestions_for_bot(bot.prompt)
        bot.suggestion1 = suggestions[0] if len(suggestions) > 0 else ""
        bot.suggestion2 = suggestions[1] if len(suggestions) > 1 else ""
        bot.suggestion3 = suggestions[2] if len(suggestions) > 2 else ""
        bot.save()

class SubscribedBotListView(generics.ListAPIView):
    """
    API view for listing the user's SUBSCRIBED bots (their collection).
    """
    serializer_class = BotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.subscribed_bots.all()

class BotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view for retrieving, updating, and deleting a bot.
    """
    queryset = Bot.objects.all()
    serializer_class = BotDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        return Bot.objects.all()

    def get_serializer_class(self):
        # Use BotSerializer for write operations (update/create) to support all fields
        if self.request.method in ['PUT', 'PATCH', 'POST']:
            return BotSerializer
        return BotDetailSerializer

class SubscribeBotView(APIView):
    """
    API view for a user to subscribe or unsubscribe from a bot.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, bot_id):
        try:
            bot = Bot.objects.get(id=bot_id)
            user = request.user
            if bot in user.subscribed_bots.all():
                user.subscribed_bots.remove(bot)
                return Response({"status": "unsubscribed"}, status=status.HTTP_200_OK)
            else:
                user.subscribed_bots.add(bot)
                return Response({"status": "subscribed"}, status=status.HTTP_200_OK)
        except Bot.DoesNotExist:
            return Response({"error": "Bot not found"}, status=status.HTTP_404_NOT_FOUND)
