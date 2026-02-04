# bots/serializers.py
from rest_framework import serializers
from .models import Bot, Category
from studio.models import StudySpace
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

User = get_user_model()

def format_number(num):
    if num < 1000:
        return str(num)
    if num < 1_000_000:
        return f"{num/1000:.1f}K".replace(".0", "")
    return f"{num/1_000_000:.1f}M".replace(".0", "")


class CategorySerializer(serializers.ModelSerializer):
    """
    Serializer for the Category model.
    """
    class Meta:
        model = Category
        fields = ('id', 'name', 'translation_key')

class MultipartListField(serializers.ListField):
    """
    Custom ListField that handles QueryDict (FormData) correctly by using getlist.
    """
    def get_value(self, dictionary):
        if hasattr(dictionary, 'getlist'):
            return dictionary.getlist(self.field_name, [])
        return dictionary.get(self.field_name, [])

class BotSerializer(serializers.ModelSerializer):
    """
    General purpose serializer for the Bot model.
    """
    categories = CategorySerializer(many=True, read_only=True)
    category_ids = MultipartListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    study_space_ids = MultipartListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    owner_username = serializers.ReadOnlyField(source='owner.username')

    class Meta:
        model = Bot
        fields = (
            'id', 'name', 'description','prompt', 'avatar_url', 'voice',
            'allow_web_search', 'strict_context',
            'publicity', 'is_official', 'owner', 'owner_username',
            'categories', 'category_ids', 'study_space_ids'
        )
        read_only_fields = ('owner',)

    def validate_category_ids(self, value):
        if len(value) > 3:
            raise serializers.ValidationError("You can select a maximum of 3 categories.")
        return value

    def create(self, validated_data):
        cat_ids = validated_data.pop('category_ids', [])
        space_ids = validated_data.pop('study_space_ids', [])

        bot = super().create(validated_data)

        if cat_ids:
            bot.categories.set(cat_ids)
        if space_ids:
            bot.study_spaces.set(space_ids)

        return bot

    def update(self, instance, validated_data):
        cat_ids = validated_data.pop('category_ids', None)
        space_ids = validated_data.pop('study_space_ids', None)

        instance = super().update(instance, validated_data)

        if cat_ids is not None:
            instance.categories.set(cat_ids)
        if space_ids is not None:
            instance.study_spaces.set(space_ids)

        return instance


class BotDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for the Bot Settings screen.
    """
    stats = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    createdByMe = serializers.SerializerMethodField()
    settings = serializers.SerializerMethodField()
    handle = serializers.ReadOnlyField(source='owner.username')

    avatarUrl = serializers.ImageField(source='avatar_url', read_only=True, use_url=True)

    class Meta:
        model = Bot
        fields = (
            'id', 'name', 'handle', 'description', 'prompt',
            'avatarUrl',
            'stats', 'tags', 'createdByMe', 'settings', 'categories',
            'allow_web_search', 'strict_context', 'study_spaces'
        )


    def get_stats(self, obj):
        """
        Calculates and formats the follower and monthly user counts.
        """
        # 1. Calcular o número de seguidores (followers)
        follower_count = obj.subscribers.count()

        # 2. Calcular os utilizadores mensais (monthly users)
        thirty_days_ago = timezone.now() - timedelta(days=30)

        # Encontra os IDs de utilizadores únicos que enviaram mensagens para este bot nos últimos 30 dias
        monthly_users_count = User.objects.filter(
            chats__bot=obj,
            chats__messages__created_at__gte=thirty_days_ago
        ).distinct().count()

        return {
            "monthlyUsers": format_number(monthly_users_count),
            "followers": format_number(follower_count)
        }

    def get_tags(self, obj):
        tags = []
        if obj.is_official:
            tags.append('official')
        for cat in obj.categories.all():
            tags.append(cat.name.lower())
        return tags

    def get_createdByMe(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.owner == request.user
        return False

    def get_settings(self, obj):
        return {
            "voice": obj.voice,
            "publicity": obj.publicity,
            "allow_web_search": obj.allow_web_search,
            "strict_context": obj.strict_context
        }
