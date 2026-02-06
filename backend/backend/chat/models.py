# chat/models.py
from django.db import models
from django.conf import settings
from bots.models import Bot
import os # Importar os

def chat_attachment_path(instance, filename):
    # O ficheiro será guardado em MEDIA_ROOT/chat_attachments/chat_<id>/<filename>
    # Isso organiza os anexos por chat.
    # Garante que o filename é seguro (Django faz isso por padrão, mas reforça)
    filename = os.path.basename(filename) # Evita ataques de path traversal
    return f'chat_attachments/chat_{instance.chat.id}/{filename}'

class Chat(models.Model):
    """
    Represents a chat session between a user and a bot.
    A user can have multiple chat sessions with the same bot, but only one can be 'active'.
    """
    class ChatStatus(models.TextChoices):
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chats')
    bot = models.ForeignKey(Bot, on_delete=models.CASCADE, related_name='chats')

    # --- NEW: Status field to manage active vs. archived conversations ---
    status = models.CharField(
        max_length=10,
        choices=ChatStatus.choices,
        default=ChatStatus.ACTIVE
    )

    # --- NEW: Timestamp for ordering the chat list ---
    last_message_at = models.DateTimeField(auto_now_add=True)

    # Context Sources directly linked to this chat
    sources = models.ManyToManyField('studio.KnowledgeSource', blank=True, related_name='chats')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_message_at'] # Order chats by the most recent message

    def __str__(self):
        return f"Chat {self.id} between {self.user.username} and {self.bot.name} ({self.status})"

class ChatMessage(models.Model):
    """
    Represents a single message in a chat.
    """
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    attachment = models.FileField(
        upload_to=chat_attachment_path,
        null=True,
        blank=True,
        max_length=500
    )
    ATTACHMENT_TYPE_CHOICES = [
        ('image', 'Image'),
        ('file', 'File'),
        ('audio', 'Audio'),
    ]
    attachment_type = models.CharField(
        max_length=10,
        choices=ATTACHMENT_TYPE_CHOICES,
        null=True,
        blank=True
    )
    original_filename = models.CharField(max_length=255, null=True, blank=True)

    # Cached content extracted from the attachment for RAG/NotebookLM features
    extracted_text = models.TextField(null=True, blank=True, help_text="Cached content extracted from the attachment")

    duration = models.IntegerField(default=0, help_text="Audio duration in milliseconds")

    # --------------------
    suggestion1 = models.CharField(max_length=128, null=True, blank=True, help_text="First follow-up suggestion.")
    suggestion2 = models.CharField(max_length=128, null=True, blank=True, help_text="Second follow-up suggestion.")

    FEEDBACK_CHOICES = [
        ('like', 'Like'),
        ('dislike', 'Dislike'),
    ]
    feedback = models.CharField(
        max_length=10,
        choices=FEEDBACK_CHOICES,
        null=True,
        blank=True
    )

    # -----------------------
    def __str__(self):
        if self.attachment and self.original_filename:
            return f"{self.role}: [Attachment: {self.original_filename}]"
        elif self.attachment:
             # Fallback se original_filename for nulo por algum motivo
             return f"{self.role}: [Attachment: {os.path.basename(self.attachment.name)}]"
        elif self.content:
             return f"{self.role}: {self.content[:50]}"
        else:
             return f"{self.role}: [Empty Message]" # Caso raro

    # Opcional: Limpar ficheiro ao apagar mensagem (Adapte para django-storages se usar nuvem)
    def delete(self, *args, **kwargs):
        storage = self.attachment.storage
        if storage and self.attachment.name and storage.exists(self.attachment.name):
            storage.delete(self.attachment.name)
        super().delete(*args, **kwargs)

class ChatResponseMetric(models.Model):
    """
    Stores metrics about a generated AI response for RAG analysis.
    """
    message = models.OneToOneField(ChatMessage, on_delete=models.CASCADE, related_name='metrics')

    # Number of unique source documents available in the context
    sources_count = models.IntegerField(default=0)

    # Number of explicit citations found in the response
    cited_count = models.IntegerField(default=0)

    # Whether the response contains at least one citation
    has_citation = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Metrics for Msg {self.message.id}: {self.cited_count}/{self.sources_count} citations"
