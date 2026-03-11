from django.contrib import admin
from .models import Chat, ChatMessage, ChatResponseMetric, TTSCache
from .models_vector import VectorChunk

@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'guest_session', 'bot', 'status', 'last_message_at', 'created_at')
    list_filter = ('status', 'bot')
    search_fields = ('user__username', 'guest_session__id', 'bot__name', 'id')
    readonly_fields = ('created_at', 'last_message_at')

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'chat', 'role', 'short_content', 'attachment_type', 'created_at')
    list_filter = ('role', 'attachment_type', 'created_at')
    search_fields = ('content', 'chat__id', 'original_filename', 'extracted_text')
    readonly_fields = ('created_at',)

    def short_content(self, obj):
        return obj.content[:50] + '...' if obj.content and len(obj.content) > 50 else obj.content
    short_content.short_description = "Content"

@admin.register(ChatResponseMetric)
class ChatResponseMetricAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'cited_count', 'sources_count', 'has_citation', 'created_at')
    list_filter = ('has_citation',)
    readonly_fields = ('created_at',)

@admin.register(TTSCache)
class TTSCacheAdmin(admin.ModelAdmin):
    list_display = ('id', 'text_hash', 'voice', 'duration_ms', 'created_at')
    list_filter = ('voice',)
    search_fields = ('text', 'text_hash')
    readonly_fields = ('created_at',)

@admin.register(VectorChunk)
class VectorChunkAdmin(admin.ModelAdmin):
    list_display = ('id', 'type', 'short_content', 'user_id', 'bot_id', 'created_at')
    list_filter = ('type', 'created_at')
    search_fields = ('content', 'user_id', 'bot_id')
    readonly_fields = ('created_at',)

    def short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    short_content.short_description = "Content"
