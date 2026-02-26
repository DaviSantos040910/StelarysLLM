"""
fix_migration.py - Fix inconsistent migration history.

Inserts the missing bots.0002 migration record directly into the
django_migrations table, bypassing Django's consistency check.

Run with: python fix_migration.py
"""
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.db import connection

MIGRATION_APP = 'bots'
MIGRATION_NAME = '0002_bot_suggestion1_bot_suggestion2_bot_suggestion3'

with connection.cursor() as cursor:
    # Check if already exists
    cursor.execute(
        "SELECT COUNT(*) FROM django_migrations WHERE app=%s AND name=%s",
        [MIGRATION_APP, MIGRATION_NAME]
    )
    count = cursor.fetchone()[0]

    if count > 0:
        print(f"SKIP: {MIGRATION_APP}.{MIGRATION_NAME} already in django_migrations table.")
    else:
        cursor.execute(
            "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
            [MIGRATION_APP, MIGRATION_NAME]
        )
        print(f"OK: Inserted {MIGRATION_APP}.{MIGRATION_NAME} into django_migrations.")

print("Done. You can now run 'python manage.py migrate' normally.")
