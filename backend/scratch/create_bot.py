from bots.models import Bot, Category
import os

def create_official_bot():
    # 1. Create or get Category
    cat, created = Category.objects.get_or_create(
        name="Idiomas",
        defaults={"translation_key": "languages"}
    )
    if created:
        print(f"Categoria '{cat.name}' criada.")
    else:
        print(f"Categoria '{cat.name}' já existia.")

    # 2. Create Official Bot
    bot_name = "Polyglot Tutor"
    bot_prompt = (
        "Você é o Polyglot Tutor, um assistente de IA oficial do Stelarys especializado no ensino de idiomas. "
        "Sua missão é ajudar o usuário a aprender qualquer língua de forma interativa e prática.\n\n"
        "Regras:\n"
        "1. Identifique o nível do usuário e o idioma que ele deseja praticar.\n"
        "2. Corrija gramática e pronúncia (por texto) de forma gentil.\n"
        "3. Ofereça sugestões de vocabulário e exercícios rápidos.\n"
        "4. Incentive o uso do idioma alvo o máximo possível.\n"
        "Seja motivador e paciente."
    )
    
    bot, bot_created = Bot.objects.get_or_create(
        name=bot_name,
        is_official=True,
        defaults={
            "description": "Seu tutor mestre para aprender e praticar qualquer idioma do mundo.",
            "prompt": bot_prompt,
            "publicity": "Public",
            "voice": "professor",
            "suggestion1": "Como posso dizer 'estou com fome' em Francês?",
            "suggestion2": "Pode praticar conversação básica em Inglês comigo?",
            "suggestion3": "Quais são as frases mais comuns em Alemão para viagens?"
        }
    )
    
    if bot_created:
        bot.categories.add(cat)
        print(f"Bot oficial '{bot.name}' criado com sucesso.")
    else:
        print(f"Bot oficial '{bot.name}' já existe.")

if __name__ == "__main__":
    create_official_bot()
