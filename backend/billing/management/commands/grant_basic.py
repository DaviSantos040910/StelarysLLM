from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from billing.models import Plan, Subscription

class Command(BaseCommand):
    help = 'Grants BASIC plan to a user'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)

    def handle(self, *args, **options):
        username = options['username']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found'))
            return

        # Ensure Plan exists
        plan, _ = Plan.objects.get_or_create(
            code='basic',
            defaults={
                'name': 'Basic Plan',
                'price_cents': 2990,
                'limits': {'messages_monthly': 2000}
            }
        )

        # Create/Update Subscription
        sub, created = Subscription.objects.get_or_create(user=user, defaults={'plan': plan})
        sub.plan = plan
        sub.status = Subscription.Status.ACTIVE
        sub.current_period_end = timezone.now() + timedelta(days=30)
        sub.save()

        self.stdout.write(self.style.SUCCESS(f'Granted BASIC plan to {username} until {sub.current_period_end}'))
