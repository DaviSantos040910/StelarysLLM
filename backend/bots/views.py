# bots/views.py
from rest_framework import generics, permissions, status, parsers
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Bot
from .serializers import BotSerializer, BotDetailSerializer
from chat.services import generate_suggestions_for_bot
from accounts.permissions import IsUserOrGuest
from accounts.utils import get_actor

class BotListCreateView(generics.ListCreateAPIView):
    """
    API view for listing user's CREATED bots and creating new ones.
    """
    serializer_class = BotSerializer
    permission_classes = [IsUserOrGuest]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        actor_type, actor = get_actor(self.request)
        if actor_type == 'user':
            return Bot.objects.filter(owner=actor)
        elif actor_type == 'guest':
            return Bot.objects.filter(guest_session=actor)
        return Bot.objects.none()

    def perform_create(self, serializer):
        actor_type, actor = get_actor(self.request)

        if actor_type == 'user':
            bot = serializer.save(owner=actor)
            bot.subscribers.add(actor)
        else:
            bot = serializer.save(guest_session=actor, owner=None)

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
    permission_classes = [IsUserOrGuest]

    def get_queryset(self):
        actor_type, actor = get_actor(self.request)
        if actor_type == 'user':
            return actor.subscribed_bots.all()
        # Guests don't have subscriptions yet
        return Bot.objects.none()

class BotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view for retrieving, updating, and deleting a bot.
    """
    queryset = Bot.objects.all()
    serializer_class = BotDetailSerializer
    permission_classes = [IsUserOrGuest]
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
    permission_classes = [IsUserOrGuest]

    def post(self, request, bot_id):
        actor_type, actor = get_actor(request)
        if actor_type != 'user':
             return Response({"error": "Guests cannot subscribe to bots."}, status=status.HTTP_403_FORBIDDEN)

        try:
            bot = Bot.objects.get(id=bot_id)
            user = actor
            if bot in user.subscribed_bots.all():
                user.subscribed_bots.remove(bot)
                return Response({"status": "unsubscribed"}, status=status.HTTP_200_OK)
            else:
                user.subscribed_bots.add(bot)
                return Response({"status": "subscribed"}, status=status.HTTP_200_OK)
        except Bot.DoesNotExist:
            return Response({"error": "Bot not found"}, status=status.HTTP_404_NOT_FOUND)
