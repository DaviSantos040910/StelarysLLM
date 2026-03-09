from django.db import models
from django.conf import settings
from django.db.models import JSONField, CheckConstraint, Q
from django.utils import timezone

class Plan(models.Model):
    """
    Defines available subscription plans (e.g., 'trial', 'basic', 'pro').
    """
    code = models.CharField(max_length=50, unique=True, help_text="Slug for the plan (e.g., 'basic')")
    name = models.CharField(max_length=100)
    price_cents = models.IntegerField(default=0, help_text="Price in cents (e.g., 2990 for R$29,90)")
    is_public = models.BooleanField(default=False)
    limits = JSONField(default=dict, help_text="JSON defining quota limits (e.g., {'messages_monthly': 2000})")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

class Subscription(models.Model):
    """
    Represents a user's subscription to a plan.
    Currently focused on 'basic'.
    """
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        CANCELED = 'canceled', 'Canceled'
        PAST_DUE = 'past_due', 'Past Due'
        INCOMPLETE = 'incomplete', 'Incomplete'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # Store provider details (prepared for Google Play)
    provider = models.CharField(max_length=50, default='manual') # 'google_play', 'stripe', 'manual'
    product_id = models.CharField(max_length=255, null=True, blank=True)
    purchase_token = models.TextField(null=True, blank=True)

    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_active(self):
        return self.status == self.Status.ACTIVE and (
            self.current_period_end is None or self.current_period_end > timezone.now()
        )

    def __str__(self):
        return f"{self.user} - {self.plan.name} ({self.status})"

class UsageCounter(models.Model):
    """
    Tracks MONTHLY usage for a user (for Basic/Pro plans).
    Period format: 'YYYY-MM'
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='usage_counters')
    period = models.CharField(max_length=7, db_index=True) # YYYY-MM

    messages_count = models.IntegerField(default=0)
    artifacts_count = models.IntegerField(default=0)
    tts_seconds_count = models.IntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'period')

    def __str__(self):
        return f"{self.user} [{self.period}]: {self.messages_count} msgs"

class TrialUsageCounter(models.Model):
    """
    Tracks TOTAL usage during the TRIAL period.
    Can be linked to a User OR a GuestSession.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='trial_usage')
    guest_session = models.OneToOneField('accounts.GuestSession', on_delete=models.CASCADE, null=True, blank=True, related_name='trial_usage')

    messages_count = models.IntegerField(default=0)

    # Artifacts by type (JSON map: {'podcast': 1, 'summary': 0, ...})
    artifacts_usage = JSONField(default=dict)

    # Other hard limits
    memory_used = models.BooleanField(default=False)
    source_count = models.IntegerField(default=0)
    tutor_count = models.IntegerField(default=0)
    space_count = models.IntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            CheckConstraint(
                check=Q(user__isnull=False) | Q(guest_session__isnull=False),
                name='trial_usage_owner_required'
            ),
            CheckConstraint(
                check=~(Q(user__isnull=False) & Q(guest_session__isnull=False)),
                name='trial_usage_owner_exclusive'
            )
        ]

    def __str__(self):
        owner = self.user if self.user else self.guest_session
        return f"Trial Usage: {owner}"
