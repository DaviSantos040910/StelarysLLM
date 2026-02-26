from django.urls import path
from .views import (
    ActiveChatListView,
    ArchivedChatListView,
    ChatBootstrapView,
    ChatMessageListView,
    StreamChatMessageView,
    ChatMessageAttachmentView,
    AudioTranscriptionView,
    VoiceInteractionView,
    VoiceMessageView,
    ArchiveChatView,
    SetActiveChatView,
    MessageFeedbackView,
    RegenerateMessageView,
    MessageTTSView,
    ChatSourceView,
    ContextSourcesView,
)
from .views_internal import IngestionTaskView

urlpatterns = [
    # List active chats
    path('', ActiveChatListView.as_view(), name='chat-list'),

    # List archived chats for a bot
    path('archived/bot/<int:bot_id>/', ArchivedChatListView.as_view(), name='archived-chat-list'),

    # Bootstrap (get/create active chat for bot)
    path('bootstrap/bot/<int:bot_id>/', ChatBootstrapView.as_view(), name='chat-bootstrap'),

    # Messages in a chat (List/Create)
    path('<int:chat_pk>/messages/', ChatMessageListView.as_view(), name='chat-message-list'),

    # Streaming
    path('<int:pk>/stream/', StreamChatMessageView.as_view(), name='chat-stream'),

    # Attachments
    path('<int:chat_pk>/messages/attach/', ChatMessageAttachmentView.as_view(), name='chat-message-attach'),

    # Audio/Voice
    path('<int:chat_pk>/audio/transcribe/', AudioTranscriptionView.as_view(), name='audio-transcribe'),
    path('<int:chat_pk>/voice-interact/', VoiceInteractionView.as_view(), name='voice-interact'),
    path('<int:chat_pk>/voice-message/', VoiceMessageView.as_view(), name='voice-message'),

    # Management
    path('<int:chat_id>/archive/', ArchiveChatView.as_view(), name='chat-archive'),
    path('<int:chat_id>/set-active/', SetActiveChatView.as_view(), name='chat-set-active'),

    # Interaction
    path('<int:chat_pk>/messages/<int:message_id>/feedback/', MessageFeedbackView.as_view(), name='message-feedback'),
    path('<int:chat_pk>/regenerate/', RegenerateMessageView.as_view(), name='chat-regenerate'),
    path('<int:chat_pk>/messages/<int:message_id>/tts/', MessageTTSView.as_view(), name='message-tts'),

    # Context Sources
    path('<int:chat_id>/sources/', ChatSourceView.as_view(), name='chat-sources'),
    path('<int:chat_id>/sources/<int:source_id>/', ChatSourceView.as_view(), name='chat-source-delete'),
    path('<int:chat_id>/context-sources/', ContextSourcesView.as_view(), name='chat-context-sources'),

    # Internal Tasks
    path('internal/tasks/ingest_youtube/', IngestionTaskView.as_view(), name='internal-task-ingest-youtube'),
]
