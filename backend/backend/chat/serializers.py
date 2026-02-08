# chat/serializers.py
from rest_framework import serializers
from .models import Chat, ChatMessage
from bots.serializers import BotSerializer

class ChatMessageSerializer(serializers.ModelSerializer):
    suggestions = serializers.SerializerMethodField()
    # Campo calculado para obter URL completa
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        # Adicionado 'duration' e 'feedback' aos fields para leitura no frontend
        fields = ('id', 'chat', 'role', 'content', 'created_at', 'suggestions',
                  'attachment_url', 'attachment_type', 'original_filename', 'duration', 'feedback', 'sources')

        # Define campos que são apenas leitura na visualização padrão
        read_only_fields = ('id', 'chat','role', 'created_at', 'suggestions',
                          'attachment_url', 'attachment_type', 'original_filename')

    def get_suggestions(self, obj):
        suggestions_list = []
        if obj.suggestion1: suggestions_list.append(obj.suggestion1)
        if obj.suggestion2: suggestions_list.append(obj.suggestion2)
        return suggestions_list

    def get_attachment_url(self, obj):
        if obj.attachment and hasattr(obj.attachment, 'url'):
            request = self.context.get('request', None)
            if request:
                try:
                   # Tenta construir URL absoluta usando o request context
                   return request.build_absolute_uri(obj.attachment.url)
                except Exception:
                    # Fallback para URL relativa
                    return obj.attachment.url
            return obj.attachment.url
        return None

class ChatListSerializer(serializers.ModelSerializer):
    bot = BotSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ('id', 'bot', 'last_message', 'last_message_at', 'status')

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return ChatMessageSerializer(last_msg, context=self.context).data
        return None

class ChatMessageAttachmentSerializer(serializers.ModelSerializer):
    # Define 'attachment' como write-only para upload
    attachment = serializers.FileField(write_only=True, required=True, max_length=500)
    content = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    # Aceita duração no upload vindo do frontend (ex: gravador de voz)
    duration = serializers.IntegerField(required=False, default=0)

    class Meta:
        model = ChatMessage
        fields = ('id', 'chat', 'role', 'content', 'created_at',
                  'attachment', 'attachment_type', 'original_filename', 'duration')

        read_only_fields = ('id', 'chat', 'role', 'created_at')

    def validate_attachment(self, value):
        MAX_UPLOAD_SIZE = 50 * 1024 * 1024 # Aumentado para 50MB para consistência com frontend
        if value.size > MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(f"File size cannot exceed {MAX_UPLOAD_SIZE // (1024*1024)}MB.")
        return value
