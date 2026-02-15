from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChatViewSet,
    StreamChatMessageView,
    ChatMessageViewSet,
    ChatFeedbackView
)
from .views_internal import IngestionTaskView

router = DefaultRouter()
router.register(r'conversations', ChatViewSet, basename='chat')
router.register(r'messages', ChatMessageViewSet, basename='message')

urlpatterns = [
    path('', include(router.urls)),
    path('conversations/<int:chat_id>/stream/', StreamChatMessageView.as_view(), name='chat-stream'),
    path('messages/<int:message_id>/feedback/', ChatFeedbackView.as_view(), name='message-feedback'),

    # Internal Task Route for YouTube Ingestion
    path('internal/tasks/ingest_youtube/', IngestionTaskView.as_view(), name='internal-task-ingest-youtube'),
]
