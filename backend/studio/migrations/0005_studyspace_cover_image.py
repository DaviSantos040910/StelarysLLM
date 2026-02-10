from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("studio", "0004_studyspace"),
    ]

    operations = [
        migrations.AddField(
            model_name="studyspace",
            name="cover_image",
            field=models.ImageField(blank=True, null=True, upload_to="study_spaces/"),
        ),
    ]
