# Generated manually to bypass Windows fork error on django-rq
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_trial_ends_at_user_trial_started_at'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='is_premium',
        ),
    ]
