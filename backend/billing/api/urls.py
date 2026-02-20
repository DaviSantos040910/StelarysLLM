from django.urls import path
from .views import EntitlementsView, GooglePlayVerifyView

urlpatterns = [
    path('entitlements/', EntitlementsView.as_view(), name='billing-entitlements'),
    path('status/', EntitlementsView.as_view(), name='billing-status'),
    path('google-play/verify/', GooglePlayVerifyView.as_view(), name='billing-google-play-verify'),
]
