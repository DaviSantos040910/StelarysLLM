import uuid
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.conf import settings

class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    # --- Trial Fields ---
    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.username

class GuestSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    claimed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='guest_sessions')
    claimed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    trial_expires_at = models.DateTimeField(null=True, blank=True)
    device_label = models.CharField(max_length=255, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.trial_expires_at:
            # Use configured trial duration (default 3 days = 4320 minutes)
            minutes = getattr(settings, 'GUEST_TRIAL_MINUTES', 4320)
            self.trial_expires_at = timezone.now() + timedelta(minutes=minutes)
        super().save(*args, **kwargs)

    def __str__(self):
        status = "Active" if self.is_active else "Inactive"
        return f"Guest {str(self.id)[:8]} ({status})"
