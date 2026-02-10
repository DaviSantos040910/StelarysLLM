from django.db import models
from django.conf import settings
from chat.models import Chat

class KnowledgeSource(models.Model):
    class SourceType(models.TextChoices):
        FILE = 'FILE', 'File'
        URL = 'URL', 'URL'
        YOUTUBE = 'YOUTUBE', 'YouTube'
        IMAGE = 'IMAGE', 'Image'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='knowledge_sources')
    title = models.CharField(max_length=255)
    source_type = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.FILE)

    # File upload
    file = models.FileField(upload_to='library_sources/', null=True, blank=True)
    # OR URL
    url = models.URLField(null=True, blank=True)

    # Extracted content for RAG/Context
    extracted_text = models.TextField(null=True, blank=True)

    # Metadata (e.g. YouTube ID, author, duration)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.source_type})"

class StudySpace(models.Model):
    """
    Groups Knowledge Sources into a study space.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='study_spaces')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to='study_spaces/', null=True, blank=True)

    # Relationship with KnowledgeSource (Many-to-Many)
    sources = models.ManyToManyField(KnowledgeSource, related_name='study_spaces', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class KnowledgeArtifact(models.Model):
    class ArtifactType(models.TextChoices):
        SLIDE = 'SLIDE', 'Slide'
        QUIZ = 'QUIZ', 'Quiz'
        FLASHCARD = 'FLASHCARD', 'Flashcard'
        SPREADSHEET = 'SPREADSHEET', 'Spreadsheet'
        WORKBOOK = 'WORKBOOK', 'Workbook'
        PODCAST = 'PODCAST', 'Podcast'
        SUMMARY = 'SUMMARY', 'Summary'

    class Status(models.TextChoices):
        PROCESSING = 'processing', 'Processing'
        READY = 'ready', 'Ready'
        ERROR = 'error', 'Error'

    class Stage(models.TextChoices):
        QUEUED = 'QUEUED', 'Queued'
        ASSEMBLING_CONTEXT = 'ASSEMBLING_CONTEXT', 'Assembling Context'
        GENERATING = 'GENERATING', 'Generating Content'
        RENDERING_EXPORT = 'RENDERING_EXPORT', 'Rendering Export'
        READY = 'READY', 'Ready'
        ERROR = 'ERROR', 'Error'

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='artifacts')
    type = models.CharField(max_length=20, choices=ArtifactType.choices)
    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING
    )

    # Polymorphic content (JSON structure differs by type)
    content = models.JSONField(null=True, blank=True)

    # Specific fields for Podcast or other media
    media_url = models.URLField(null=True, blank=True)
    duration = models.CharField(max_length=20, null=True, blank=True) # "5:30", "10:00"

    # Optional score if we want to store user performance on a quiz artifact here?
    # The frontend interface shows `score?: string`.
    score = models.CharField(max_length=20, null=True, blank=True)

    # Job tracking
    stage = models.CharField(
        max_length=50,
        choices=Stage.choices,
        default=Stage.QUEUED
    )
    correlation_id = models.UUIDField(null=True, blank=True)
    attempts = models.IntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type}: {self.title} ({self.status})"
