# test_streaming.py
"""
Script para testar métodos de streaming da API Google GenAI.
Coloque na raiz do projeto (mesmo nível que manage.py).
"""

from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

# Carregar as variáveis de ambiente do ficheiro .env
load_dotenv()

# Configurar a API com a sua chave
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ ERRO: GEMINI_API_KEY não encontrada no ficheiro .env")
    exit(1)

print(f"✅ API Key encontrada: {api_key[:10]}...{api_key[-5:]}\n")

# Criar o cliente com a chave de API
client = genai.Client(api_key=api_key)

print("=" * 70)
print("MÉTODOS DISPONÍVEIS NO client.models:")
print("=" * 70)
methods = [m for m in dir(client.models) if not m.startswith('_')]
for method in methods:
    print(f"  - {method}")

print("\n" + "=" * 70)
print("TESTE 1: generate_content() SEM parâmetro stream")
print("=" * 70)
try:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Conte até 3',
        config=types.GenerateContentConfig(temperature=0.7, max_output_tokens=50)
    )
    print(f"✅ Tipo da resposta: {type(response)}")
    print(f"   Tem .text? {hasattr(response, 'text')}")
    print(f"   É iterável? {hasattr(response, '__iter__') and not isinstance(response, str)}")
    
    if hasattr(response, 'text'):
        print(f"   Conteúdo: {response.text[:100]}")
        
except Exception as e:
    print(f"❌ ERRO: {type(e).__name__}: {e}")

print("\n" + "=" * 70)
print("TESTE 2: Tentar adicionar stream=True (vai dar erro se não suportar)")
print("=" * 70)
try:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Diga olá',
        config=types.GenerateContentConfig(temperature=0.7),
        stream=True  # Testar se aceita este parâmetro
    )
    print(f"✅ Aceitou stream=True!")
    print(f"   Tipo: {type(response)}")
    print(f"   É iterável? {hasattr(response, '__iter__')}")
    
    if hasattr(response, '__iter__'):
        print("   Iterando sobre os chunks:")
        for i, chunk in enumerate(response):
            if hasattr(chunk, 'text') and chunk.text:
                print(f"     Chunk {i}: {chunk.text[:30]}...")
            if i >= 2:
                break
                
except TypeError as e:
    print(f"❌ stream=True NÃO É ACEITO")
    print(f"   Erro: {e}")
except Exception as e:
    print(f"❌ Outro erro: {type(e).__name__}: {e}")

print("\n" + "=" * 70)
print("TESTE 3: Verificar se existe generate_content_stream()")
print("=" * 70)

if hasattr(client.models, 'generate_content_stream'):
    print("✅ Método generate_content_stream() EXISTE!")
    try:
        stream = client.models.generate_content_stream(
            model='gemini-2.5-flash',
            contents='Liste 3 cores',
            config=types.GenerateContentConfig(temperature=0.7)
        )
        print(f"   Tipo do stream: {type(stream)}")
        print("   Iterando:")
        for i, chunk in enumerate(stream):
            if hasattr(chunk, 'text') and chunk.text:
                print(f"     Chunk {i}: {chunk.text[:30]}...")
            if i >= 2:
                break
    except Exception as e:
        print(f"❌ Erro ao usar generate_content_stream: {e}")
else:
    print("❌ Método generate_content_stream() NÃO EXISTE")

print("\n" + "=" * 70)
print("TESTE 4: Verificar atributos de GenerateContentConfig")
print("=" * 70)
config_attrs = [a for a in dir(types.GenerateContentConfig) if not a.startswith('_')]
print("Atributos disponíveis em GenerateContentConfig:")
for attr in config_attrs:
    print(f"  - {attr}")

print("\n" + "=" * 70)
print("CONCLUSÃO E RECOMENDAÇÃO:")
print("=" * 70)

print("""
Baseado nos testes acima:

Se TESTE 2 funcionou (stream=True aceito):
  ✅ Usar: client.models.generate_content(..., stream=True)
  
Se TESTE 3 funcionou (método existe):
  ✅ Usar: client.models.generate_content_stream(...)
  
Se ambos falharam:
  ⚠️  Atualizar biblioteca: pip install --upgrade google-genai
  
Aguardando resultado para implementar a solução correta...
""")
