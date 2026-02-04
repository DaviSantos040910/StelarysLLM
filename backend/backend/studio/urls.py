from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeArtifactViewSet, StudySpaceViewSet, KnowledgeSourceViewSet

router = DefaultRouter()
router.register(r'artifacts', KnowledgeArtifactViewSet, basename='knowledgeartifact')
router.register(r'spaces', StudySpaceViewSet, basename='studyspace')
router.register(r'sources', KnowledgeSourceViewSet, basename='knowledgesource')

urlpatterns = [
    path('', include(router.urls)),
]
