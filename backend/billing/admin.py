from django.contrib import admin
from .models import Plan, Subscription, UsageCounter, TrialUsageCounter

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'price_cents', 'is_public', 'created_at')
    list_editable = ('is_public', 'price_cents')
    search_fields = ('name', 'code')
    list_filter = ('is_public',)

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan', 'status', 'provider', 'current_period_end', 'is_active')
    list_filter = ('status', 'provider', 'plan')
    search_fields = ('user__username', 'user__email', 'product_id', 'purchase_token')
    raw_id_fields = ('user',)

@admin.register(UsageCounter)
class UsageCounterAdmin(admin.ModelAdmin):
    list_display = ('user', 'period', 'messages_count', 'artifacts_count', 'tts_seconds_count', 'updated_at')
    list_filter = ('period',)
    search_fields = ('user__username', 'user__email', 'period')
    raw_id_fields = ('user',)

@admin.register(TrialUsageCounter)
class TrialUsageCounterAdmin(admin.ModelAdmin):
    list_display = ('get_owner', 'messages_count', 'tts_seconds_count', 'updated_at')
    search_fields = ('user__username', 'user__email', 'guest_session__id')
    raw_id_fields = ('user', 'guest_session')

    def get_owner(self, obj):
        return obj.user if obj.user else obj.guest_session
    get_owner.short_description = 'Owner'
