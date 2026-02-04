# bots/admin.py
from django.contrib import admin
from .models import Bot, Category

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """
    Admin interface options for the Category model.
    """
    list_display = ('name', 'id')
    search_fields = ('name',)

@admin.register(Bot)
class BotAdmin(admin.ModelAdmin):
    """
    Admin interface options for the Bot model.
    """
    # --- CORREÇÃO APLICADA AQUI ---
    # Substituímos 'category' por 'display_categories' para mostrar as categorias.
    list_display = ('name', 'owner', 'display_categories', 'publicity', 'is_official')
    # E atualizamos o 'list_filter' para usar o nome de campo correto.
    list_filter = ('is_official', 'publicity', 'categories')

    search_fields = ('name', 'owner__username')
    # O campo 'language' foi removido
    fields = ('name', 'prompt', 'owner', 'categories', 'publicity', 'is_official', 'avatar_url', 'voice')
    raw_id_fields = ('owner',)
    # Use filter_horizontal for a much better user experience with ManyToManyFields
    filter_horizontal = ('categories',)

    def display_categories(self, obj):
        """
        Creates a string for the admin list display that shows all categories for a bot.
        """
        return ", ".join([category.name for category in obj.categories.all()])

    # Set a user-friendly column header for our custom method
    display_categories.short_description = 'Categories'