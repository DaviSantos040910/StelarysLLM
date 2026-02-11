# explore/models.py
from django.db import models
from django.conf import settings

class SearchHistory(models.Model):
    """Stores a user's search history."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='search_history', null=True, blank=True)
    guest_session = models.ForeignKey('accounts.GuestSession', on_delete=models.SET_NULL, null=True, blank=True, related_name='search_history')
    term = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'term'],
                name='unique_user_term',
                condition=models.Q(user__isnull=False)
            ),
            models.UniqueConstraint(
                fields=['guest_session', 'term'],
                name='unique_guest_term',
                condition=models.Q(guest_session__isnull=False)
            )
        ]

    def __str__(self):
        owner = self.user.username if self.user else "Guest"
        return f"{owner} searched for '{self.term}'"