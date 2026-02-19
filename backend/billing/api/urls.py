from django.urls import path
from .views import EntitlementsView

urlpatterns = [
    path('entitlements/', EntitlementsView.as_view(), name='billing-entitlements'),
    path('status/', EntitlementsView.as_view(), name='billing-status'),
]
