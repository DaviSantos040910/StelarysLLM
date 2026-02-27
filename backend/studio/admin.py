from django.contrib import admin
from .models import KnowledgeSource, StudySpace, KnowledgeArtifact

@admin.register(KnowledgeSource)
class KnowledgeSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'source_type', 'user', 'guest_session', 'created_at')
    list_filter = ('source_type', 'created_at')
    search_fields = ('title', 'url', 'user__username', 'guest_session__id')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(StudySpace)
class StudySpaceAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'user', 'guest_session', 'created_at', 'updated_at')
    list_filter = ('created_at',)
    search_fields = ('title', 'user__username', 'guest_session__id')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(KnowledgeArtifact)
class KnowledgeArtifactAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'type', 'status', 'stage', 'created_at', 'duration')
    list_filter = ('type', 'status', 'stage', 'created_at')
    search_fields = ('title', 'chat__id', 'error_message', 'job_id')
    readonly_fields = ('created_at',)
