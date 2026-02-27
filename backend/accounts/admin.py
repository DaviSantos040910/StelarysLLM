# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, GuestSession

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    # Adicione 'is_premium' para que apareça na lista de usuários
    list_display = ("username", "email", "is_email_verified", "is_premium", "is_staff")
    list_filter = ("is_email_verified", "is_staff", "is_superuser", "is_premium")
    search_fields = ("username", "email")

    # Adicione o campo 'is_premium' à seção de 'fieldsets' para que seja editável
    # Copiamos os fieldsets padrão e adicionamos o nosso campo
    fieldsets = DjangoUserAdmin.fieldsets + (
        ('Premium Status', {'fields': ('is_premium',)}),
    )

@admin.register(GuestSession)
class GuestSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "is_active", "created_at", "last_seen_at", "claimed_by", "claimed_at", "trial_expires_at", "device_label", "installation_id")
    list_filter = ("is_active", "claimed_at")
    search_fields = ("id", "device_label", "claimed_by__email", "claimed_by__username", "installation_id")
    readonly_fields = ("created_at", "last_seen_at", "claimed_at")