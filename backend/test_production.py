import requests
import sys

BASE_URL = "https://backend-api-140218503200.us-central1.run.app/api/v1"

def test_login(identifier, password):
    print(f"\n[Test] Realizando login para {identifier}...")
    url = f"{BASE_URL}/auth/login/"
    data = {"identifier": identifier, "password": password}
    response = requests.post(url, json=data)
    
    if response.status_code == 200:
        print("✅ Login realizado com sucesso!")
        payload = response.json()
        print(f"   Email Verificado no Payload: {payload.get('email_verified')}")
        return payload.get("token")
    else:
        print(f"❌ Falha no login: {response.status_code}")
        print(response.text)
        return None

def test_me(token):
    print("\n[Test] Verificando perfil /me/...")
    url = f"{BASE_URL}/accounts/me/"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ User: {data.get('username')}")
        print(f"✅ Email Verificado: {data.get('is_email_verified')}")
    else:
        print(f"❌ Falha no /me/: {response.status_code}")

def test_chat(token):
    print("\n[Test] Verificando criação de chat e resposta...")
    # Primeiro, listar ou criar um chat (assumindo que existe um bot padrão)
    # Por simplicidade, assumirei IDs ou criarei um novo se o endpoint permitir
    print("   (Ignorado por agora para não poluir o DB sem necessidade)")

if __name__ == "__main__":
    # Estes dados devem ser fornecidos ou usados de um usuário de teste
    if len(sys.argv) < 3:
        print("Uso: python test_production.py <identifier> <password>")
    else:
        ident = sys.argv[1]
        pwd = sys.argv[2]
        token = test_login(ident, pwd)
        if token:
            test_me(token)
