# chat/urls.py
from django.urls import path
from .views import (
    ActiveChatListView,
    ChatMessageListView,
    AudioTranscriptionView,
    ChatBootstrapView,
    ArchiveChatView,
    ArchivedChatListView,
    SetActiveChatView,
    ChatMessageAttachmentView,
    MessageTTSView,
    MessageFeedbackView, # Updated
    RegenerateMessageView, # Added
    VoiceInteractionView,
    VoiceMessageView,
    StreamChatMessageView,
    ContextSourcesView,
    ChatSourceView
)

urlpatterns = [
    # GET /api/v1/chats/ -> Lists active chats for the main screen
    path('', ActiveChatListView.as_view(), name='active-chat-list'),

    # GET /api/v1/chats/archived/bot/<bot_id>/ -> Lists archived chats for a bot
    path('archived/bot/<int:bot_id>/', ArchivedChatListView.as_view(), name='archived-chat-list'),

    # POST /api/v1/chats/<chat_id>/archive/ -> Archives a chat and creates a new one
    path('<int:chat_id>/archive/', ArchiveChatView.as_view(), name='archive-chat'),

    path('<int:chat_id>/set-active/', SetActiveChatView.as_view(), name='set-active-chat'),

    path('bootstrap/bot/<int:bot_id>/', ChatBootstrapView.as_view(), name='chat-bootstrap'),
    path('<int:chat_pk>/messages/', ChatMessageListView.as_view(), name='chat-message-list-create'),
    path('<int:chat_pk>/messages/attach/', ChatMessageAttachmentView.as_view(), name='chat-message-attach'),
    path('<int:chat_pk>/messages/<int:message_id>/tts/', MessageTTSView.as_view(), name='message-tts'),

    # Updated: Feedback endpoint (replaces like)
    path('<int:chat_pk>/messages/<int:message_id>/feedback/', MessageFeedbackView.as_view(), name='message-feedback'),

    # Added: Regenerate endpoint
    path('<int:chat_pk>/regenerate/', RegenerateMessageView.as_view(), name='chat-regenerate'),

    path('<int:chat_pk>/transcribe/', AudioTranscriptionView.as_view(), name='audio-transcription'),
    path('<int:chat_pk>/voice/', VoiceInteractionView.as_view(), name='chat-voice'),
    path('<int:chat_pk>/voice-message/', VoiceMessageView.as_view(), name='chat-voice-message'),
    path('<int:pk>/stream/', StreamChatMessageView.as_view(), name='chat-message-stream'),

    # Context Sources - Nested under chat ID
    path('<int:chat_id>/context-sources/', ContextSourcesView.as_view(), name='context-sources'),
    path('<int:chat_id>/sources/', ChatSourceView.as_view(), name='chat-source-list-create'),
    path('<int:chat_id>/sources/<int:source_id>/', ChatSourceView.as_view(), name='chat-source-delete'),

]
