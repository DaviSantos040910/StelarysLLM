# bots/urls.py
from django.urls import path
from .views import (
    BotListCreateView,
    BotDetailView,
    SubscribedBotListView, # New import
    SubscribeBotView     # New import
)
from .admin_views import * # Keep admin imports

urlpatterns = [
    # --- User-facing URLs ---
    path('', BotListCreateView.as_view(), name='bot-list-create'),
    path('<int:pk>/', BotDetailView.as_view(), name='bot-detail'),

    # --- NEW URLs ---
    path('subscribed/', SubscribedBotListView.as_view(), name='subscribed-bot-list'),
    path('<int:bot_id>/subscribe/', SubscribeBotView.as_view(), name='subscribe-bot'),

    # --- Admin URLs ---
    # ... (admin urls remain the same)
]