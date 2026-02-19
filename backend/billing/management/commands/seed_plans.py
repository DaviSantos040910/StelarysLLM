from django.core.management.base import BaseCommand
from billing.models import Plan
from billing.services.entitlements import TRIAL_LIMITS, BASIC_LIMITS

class Command(BaseCommand):
    help = 'Seeds initial plans (Trial and Basic)'

    def handle(self, *args, **options):
        # 1. Trial Plan
        # Note: Trial plan is implicit in code logic (PLAN_TRIAL), but having it in DB is good for future flexibility or if we attach it to subscriptions later.
        # However, the logic heavily relies on 'is_trial_active' calculated dynamically.
        # But `Plan` model is mainly for Subscriptions.
        # Let's seed 'basic' primarily, and 'trial' just in case we move to DB-based trial config later.

        # Trial
        trial, created = Plan.objects.get_or_create(
            code='trial',
            defaults={
                'name': 'Trial (3 Dias)',
                'price_cents': 0,
                'is_public': False,
                'limits': TRIAL_LIMITS
            }
        )
        if not created:
            trial.limits = TRIAL_LIMITS
            trial.save()
            self.stdout.write(self.style.SUCCESS(f'Updated plan: {trial}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Created plan: {trial}'))

        # 2. Basic Plan
        basic, created = Plan.objects.get_or_create(
            code='basic',
            defaults={
                'name': 'Basic Plan',
                'price_cents': 2990,
                'is_public': True,
                'limits': BASIC_LIMITS
            }
        )
        if not created:
            basic.limits = BASIC_LIMITS
            basic.save()
            self.stdout.write(self.style.SUCCESS(f'Updated plan: {basic}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Created plan: {basic}'))
