from django.contrib import admin
from .models import Plan, Subscription, UsageCounter, TrialUsageCounter

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'code', 'price_cents', 'is_public', 'created_at')
    list_filter = ('is_public',)
    search_fields = ('name', 'code')

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'status', 'provider', 'created_at', 'current_period_end')
    list_filter = ('status', 'provider', 'plan')
    search_fields = ('user__username', 'user__email', 'product_id', 'purchase_token')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(UsageCounter)
class UsageCounterAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'period', 'messages_count', 'artifacts_count', 'tts_seconds_count', 'updated_at')
    list_filter = ('period',)
    search_fields = ('user__username', 'user__email')

@admin.register(TrialUsageCounter)
class TrialUsageCounterAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'guest_session',
        'messages_count', 'source_count', 'tutor_count',
        'space_count', 'memory_run_used', 'updated_at'
    )
    search_fields = ('user__username', 'user__email', 'guest_session__id', 'guest_session__device_label')
