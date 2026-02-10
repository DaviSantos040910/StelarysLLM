# explore/models.py
from django.db import models
from django.conf import settings

class SearchHistory(models.Model):
    """Stores a user's search history."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='search_history')
    term = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        unique_together = ('user', 'term') # A user can only have one entry for the same term

    def __str__(self):
        return f"{self.user.username} searched for '{self.term}'"