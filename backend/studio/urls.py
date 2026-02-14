from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeArtifactViewSet, StudySpaceViewSet, KnowledgeSourceViewSet
from .views_internal import ArtifactGenerationTaskView

router = DefaultRouter()
router.register(r'artifacts', KnowledgeArtifactViewSet, basename='knowledgeartifact')
router.register(r'spaces', StudySpaceViewSet, basename='studyspace')
router.register(r'sources', KnowledgeSourceViewSet, basename='knowledgesource')

urlpatterns = [
    path('', include(router.urls)),
    # Internal Task Route
    path('internal/tasks/generate_artifact/', ArtifactGenerationTaskView.as_view(), name='internal-task-generate-artifact'),
]
