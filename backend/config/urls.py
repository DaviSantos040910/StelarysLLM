# config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    # Main admin site
    path('admin/', admin.site.urls),

    # API URLs
    # Include all URLs from the 'accounts' app under '/auth/'
    path('auth/', include('accounts.urls')),
    path('api/v1/accounts/', include('accounts.urls')),

    # Include all URLs from the 'bots' app under '/api/v1/bots/'
    # This single line replaces all the individual bot and admin paths
    path('api/v1/bots/', include('bots.urls')),

    # Include all URLs from the 'chat' app under '/api/v1/chats/'
    path('api/v1/chats/', include('chat.urls')),

    # Include all URLs from the 'explore' app under '/api/v1/explore/'
    path('api/v1/explore/', include('explore.urls')),

    # Include all URLs from the 'studio' app under '/api/v1/studio/'
    path('api/v1/studio/', include('studio.urls')),
]
# --- Add this line at the end ---
# This tells Django to serve files from MEDIA_ROOT when in DEBUG mode.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)