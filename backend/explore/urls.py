# explore/urls.py
from django.urls import path
from .views import (
    ExploreCategoryListView, ExploreBotListView,
    SearchHistoryView, SearchHistoryDetailView
)

urlpatterns = [
    path('categories/', ExploreCategoryListView.as_view(), name='explore-categories'),
    path('bots/', ExploreBotListView.as_view(), name='explore-bots'),
    path('history/', SearchHistoryView.as_view(), name='search-history'),
    path('history/<int:pk>/', SearchHistoryDetailView.as_view(), name='search-history-detail'),
]