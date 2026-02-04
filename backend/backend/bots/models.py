# bots/models.py
from django.db import models
from django.conf import settings

class Category(models.Model):
    """Represents a category for bots."""
    name = models.CharField(max_length=100, unique=True)
    translation_key = models.SlugField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        help_text="A unique key for the frontend to use for translation, e.g., 'productivity'."
    )

    def __str__(self):
        return self.name

class Bot(models.Model):
    """Represents an AI bot created by a user."""

    class Publicity(models.TextChoices):
        PRIVATE = 'Private', 'Private'
        GUESTS = 'Guests', 'Guests'
        PUBLIC = 'Public', 'Public'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_bots')
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True, help_text="A short description of what the bot does.")
    prompt = models.TextField()
    avatar_url = models.ImageField(upload_to='bot_avatars/', null=True, blank=True)

    voice = models.CharField(max_length=50, default='EnergeticYouth')

    # --- NEW: Flag to enable web search capability ---
    allow_web_search = models.BooleanField(default=False)
    strict_context = models.BooleanField(default=False)

    publicity = models.CharField(max_length=10, choices=Publicity.choices, default=Publicity.PUBLIC)
    is_official = models.BooleanField(default=False)
    categories = models.ManyToManyField(Category, related_name='bots', blank=True)

    # Study Spaces this bot belongs to
    study_spaces = models.ManyToManyField('studio.StudySpace', related_name='bots', blank=True)

    # This field will store which users have added this bot to their personal list.
    subscribers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='subscribed_bots', blank=True)

    suggestion1 = models.CharField(max_length=128, blank=True, help_text="First suggested prompt.")
    suggestion2 = models.CharField(max_length=128, blank=True, help_text="Second suggested prompt.")
    suggestion3 = models.CharField(max_length=128, blank=True, help_text="Third suggested prompt.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
