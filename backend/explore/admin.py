from django.contrib import admin
from .models import SearchHistory

@admin.register(SearchHistory)
class SearchHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'guest_session', 'term', 'timestamp')
    list_filter = ('timestamp',)
    search_fields = ('term', 'user__username', 'guest_session__id')
