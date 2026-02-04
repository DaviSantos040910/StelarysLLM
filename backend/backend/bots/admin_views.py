# bots/admin_views.py
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Bot, Category
from .serializers import BotSerializer, CategorySerializer
from config.permissions import IsAdminUser

User = get_user_model()

class AdminBotListView(generics.ListAPIView):
    """Admin view to list all non-private bots."""
    serializer_class = BotSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        # Admins can see Public and Guests bots, but not Private ones
        return Bot.objects.exclude(publicity=Bot.Publicity.PRIVATE)

class AdminBotDetailView(generics.DestroyAPIView):
    """Admin view to delete any non-private bot."""
    serializer_class = BotSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return Bot.objects.exclude(publicity=Bot.Publicity.PRIVATE)

class AdminCategoryView(generics.ListCreateAPIView):
    """Admin view to create and list categories."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminUser]

class AdminCategoryDetailView(generics.DestroyAPIView):
    """Admin view to delete a category."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminUser]

class AdminSetUserPremiumView(APIView):
    """Admin view to toggle a user's premium status."""
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user.is_premium = not user.is_premium
            user.save()
            return Response({'status': 'success', 'is_premium': user.is_premium}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)