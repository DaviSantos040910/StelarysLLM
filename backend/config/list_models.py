from google import genai
import os
from dotenv import load_dotenv


# Carregar as variáveis de ambiente do ficheiro .env
load_dotenv()


# Configurar a API com a sua chave
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERRO: A variável GEMINI_API_KEY não foi encontrada no ficheiro .env")
else:
    # Criar o cliente com a chave de API
    client = genai.Client(api_key=api_key)
    
    print("A procurar por modelos disponíveis para a sua chave de API...")
    print("-" * 30)
    
    try:
        # Listar todos os modelos que suportam o método 'generateContent'
        print("Modelos que suportam generateContent:\n")
        for m in client.models.list():
            # Verificar se o modelo suporta a ação 'generateContent'
            if hasattr(m, 'supported_actions') and m.supported_actions:
                for action in m.supported_actions:
                    if action == "generateContent":
                        print(f"{m.name}")
                        break
        
        print("\n" + "-" * 30)
        print("Modelos que suportam embedContent:\n")
        for m in client.models.list():
            # Verificar se o modelo suporta a ação 'embedContent'
            if hasattr(m, 'supported_actions') and m.supported_actions:
                for action in m.supported_actions:
                    if action == "embedContent":
                        print(f"{m.name}")
                        break
                        
    except Exception as e:
        print(f"Ocorreu um erro ao contactar a API da Google: {e}")


    print("-" * 30)
    print("Copie um dos nomes da lista acima (ex: gemini-2.0-flash-exp) e use-o no seu código.")
