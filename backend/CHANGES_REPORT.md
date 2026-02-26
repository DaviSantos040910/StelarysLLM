# 📋 Relatório de Mudanças — Implementação do Audit Report

**Data:** 2026-02-23
**Status:** Implementado com sucesso ✅
**`manage.py check`:** Passou sem erros

---

## 📁 Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `config/settings.py` | C1, C2, C3, C4, H1, M1, M2, L5, Sentry |
| `config/urls.py` | Health check endpoint `/healthz/` |
| `accounts/views.py` | M3, M4, M7, L1, L2, H4 |
| `chat/views_internal.py` | H2, H4 |
| `studio/views_internal.py` | H2, H4 |
| `chat/views.py` | M1, H4 (upload validation + error sanitization) |
| `billing/api/exceptions.py` | Sentry capture |
| `studio/services/artifact_runner.py` | Dead code: `_p()` → `logger.info()` |
| `Dockerfile` | M5: timeout 0 → 120 |
| `.gitignore` | C5: added `env.prod.yaml` |
| `env.prod.yaml` | C5: secrets removidos |
| `setup_secrets.ps1` | Centralizador de gerenciamento de secrets no GCP |
| `deploy.ps1` | C5: `--set-secrets` para Secret Manager |
| `requirements.txt` | Pinned versions + `sentry-sdk` |

## 📁 Arquivos Removidos

| Arquivo | Motivo |
|---------|--------|
| `config/test_streaming.py` | Dead code — script de debug |
| `config/list_models.py` | Dead code — script de debug |

---

## 🔴 CRITICAL — Implementados

### C1. SECRET_KEY sem fallback inseguro ✅
```python
# Antes:
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret")

# Depois:
_secret_key = os.getenv("DJANGO_SECRET_KEY")
if not _secret_key and not DEBUG:
    raise ValueError("DJANGO_SECRET_KEY environment variable is required in production.")
SECRET_KEY = _secret_key or "dev-secret-only-for-local"
```
**Efeito:** Em produção sem `DJANGO_SECRET_KEY`, o app **não sobe**.

### C2. ALLOWED_HOSTS via env var ✅
```python
# Antes:
ALLOWED_HOSTS = ["*"]

# Depois:
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
```

### C3. CORS restrito em produção ✅
```python
# Antes:
CORS_ALLOW_ALL_ORIGINS = True

# Depois:
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Só permite tudo em dev
```

### C4. Headers SSL/HTTPS para Cloud Run ✅
```python
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
```

### C5. Secrets removidos do env.prod.yaml ✅
Secrets migrados para GCP Secret Manager (ver seção abaixo).

---

## 🟠 HIGH — Implementados

### H1. Print() removido do settings.py ✅
Linha `print("SENDGRID_SENDER =", ...)` removida.

### H2. Internal endpoints "fail closed" ✅
Se `CLOUD_TASKS_SECRET` não estiver configurado em produção, **rejeita todas as requests** (antes passava).

### H4. Mensagens de erro sanitizadas ✅
`str(e)` substituído por mensagens genéricas em:
- `accounts/views.py` — ClaimGuestView
- `chat/views_internal.py` — IngestionTaskView
- `studio/views_internal.py` — ArtifactGenerationTaskView
- `chat/views.py` — ChatMessageAttachmentView

---

## 🟡 MEDIUM — Implementados

### M1. Validação de upload de arquivos ✅
- **Limite de tamanho:** 25 MB por arquivo
- **Tipos permitidos:** PDF, DOCX, TXT, imagens (JPEG, PNG, WebP, GIF), áudios (MP3, M4A, WAV, WebM), vídeos (MP4)
- Validação aplicada no `ChatMessageAttachmentView`

### M2. DEBUG defaults to False ✅
```python
# Antes:
DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"

# Depois:
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"
```

### M3. Validação de senha em ChangePasswordView ✅
Agora usa `validate_password()` do Django antes de aceitar.

### M4. Validação de senha em ResetPasswordView ✅
Mesmo tratamento que M3.

### M5. Gunicorn timeout configurado ✅
```dockerfile
# Antes:
CMD exec gunicorn ... --timeout 0 ...

# Depois:
CMD exec gunicorn ... --timeout 120 ...
```

### M7. ForgotPasswordView não revela existência de usuário ✅
```python
# Antes (email não encontrado):
return Response({"detail": "Usuário não encontrado."}, status=404)

# Depois (sempre retorna sucesso):
return Response({"message": "Se o e-mail estiver cadastrado, enviaremos instruções de redefinição."})
```

---

## 🟢 LOW — Implementados

### L1. Rate limiting no LoginView ✅
`@ratelimit(key="ip", rate="10/m")` — Max 10 tentativas por minuto por IP.

### L2. Rate limiting no ResendVerificationView ✅
`@ratelimit(key="ip", rate="3/m")` — Max 3 tentativas por minuto por IP.

### L5. GCS default_acl corrigido ✅
```python
# Antes:
"default_acl": "None",  # String

# Depois:
"default_acl": None,  # Python None
```

---

## 🔍 Dead Code Removido

- ❌ `config/test_streaming.py` — **Deletado**
- ❌ `config/list_models.py` — **Deletado**
- ✅ `studio/services/artifact_runner.py` — `_p()` → `logger.info()` (12 chamadas convertidas)

---

## 📡 Sentry Integrado

- SDK adicionado ao `requirements.txt`
- Inicialização condicional em `config/settings.py` (só ativa quando `SENTRY_DSN` está definido e `DEBUG=False`)
- Captura de exceções no `custom_exception_handler` (`billing/api/exceptions.py`)
- Configurável via env vars: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`

---

## ☁️ Health Check Endpoint

Novo endpoint adicionado: `GET /healthz/`
```json
{"status": "ok"}
```
Não requer autenticação. Use para configurar o **startup probe** no Cloud Run.

---

## 🔑 Secrets para Google Cloud Secret Manager

Você precisa criar os seguintes secrets no GCP Secret Manager **antes do próximo deploy**:

| Secret Name | Valor | Onde Obter |
|-------------|-------|------------|
| `DJANGO_SECRET_KEY` | String longa e aleatória | Gere com: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | `postgres://appuser:SUA_SENHA@/app_db?host=/cloudsql/stellarys-lm:us-central1:stellarys-db` | Atual no env.prod.yaml |
| `SENDGRID_API_KEY` | `SG.xxxx...` | Atual no env.prod.yaml |
| `CLOUD_TASKS_SECRET` | String aleatória para validar tasks | Pode ser qualquer token forte |
| `SENTRY_DSN` | `https://xxxx@xxxx.ingest.sentry.io/xxxx` | Crie um projeto em sentry.io e copie o DSN |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | JSON completo da service account | Configurar quando ativar billing |

### Comandos para criar os secrets:

```bash
# 1. DJANGO_SECRET_KEY (gere uma nova)
echo -n "SUA_CHAVE_SECRETA_AQUI" | gcloud secrets create DJANGO_SECRET_KEY \
  --data-file=- --project=stellarys-lm

# 2. DATABASE_URL
echo -n "postgres://appuser:SUA_SENHA@/app_db?host=/cloudsql/stellarys-lm:us-central1:stellarys-db" | \
  gcloud secrets create DATABASE_URL --data-file=- --project=stellarys-lm

# 3. SENDGRID_API_KEY
echo -n "SG.xxxx..." | gcloud secrets create SENDGRID_API_KEY \
  --data-file=- --project=stellarys-lm

# 4. CLOUD_TASKS_SECRET
echo -n "SEU_TOKEN_SECRETO" | gcloud secrets create CLOUD_TASKS_SECRET \
  --data-file=- --project=stellarys-lm

# 5. SENTRY_DSN (quando tiver)
echo -n "https://xxxx@xxxx.ingest.sentry.io/xxxx" | gcloud secrets create SENTRY_DSN \
  --data-file=- --project=stellarys-lm

# 6. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (quando tiver)
echo -n '{"type":"service_account","project_id":...}' | \
  gcloud secrets create GOOGLE_PLAY_SERVICE_ACCOUNT_JSON \
  --data-file=- --project=stellarys-lm

# 7. Dar permissão à service account do Cloud Run para acessar os secrets:
gcloud secrets add-iam-policy-binding DJANGO_SECRET_KEY \
  --member="serviceAccount:stellarys-backend@stellarys-lm.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=stellarys-lm

# Repita para cada secret:
for SECRET in DATABASE_URL SENDGRID_API_KEY CLOUD_TASKS_SECRET SENTRY_DSN GOOGLE_PLAY_SERVICE_ACCOUNT_JSON; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:stellarys-backend@stellarys-lm.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=stellarys-lm
done
```

---

## 📱 Impacto no Frontend (React Native / Expo)

### 1. Upload de Arquivos — Limite de 25MB
**O que mudou:** O backend agora rejeita uploads maiores que 25MB ou com MIME types não permitidos.

**Resposta de erro do backend:**
```json
// Arquivo muito grande:
{"detail": "Arquivo 'documento.pdf' excede o limite de 25MB."}

// Tipo não permitido:
{"detail": "Tipo de arquivo não permitido: application/zip"}
```

**O que fazer no frontend:**
1. **Validar antes de enviar** — Verificar `file.size` antes do upload e mostrar alerta se > 25MB
2. **Tratar o erro 400** — Exibir mensagem amigável ao usuário
3. **Tipos permitidos:** PDF, DOCX, TXT, JPEG, PNG, WebP, GIF, MP3, M4A, WAV, WebM, MP4

**Exemplo de validação:**
```typescript
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/x-m4a',
    'audio/webm',
    'video/mp4',
];

function validateFile(file: { size: number; type: string; name: string }): string | null {
    if (file.size > MAX_UPLOAD_SIZE) {
        return `Arquivo "${file.name}" excede o limite de 25MB.`;
    }
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        return `Tipo de arquivo não permitido: ${file.type}`;
    }
    return null; // Valid
}
```

### 2. Forgot Password — Mensagem unificada
**O que mudou:** O endpoint `POST /api/accounts/forgot-password/` agora **sempre retorna status 200** com a mesma mensagem, independente de o email existir ou não.

**Antes:**
```json
// Email não encontrado → 404:
{"detail": "Usuário não encontrado."}

// Email encontrado → 200:
{"message": "E-mail de redefinição enviado."}
```

**Depois (sempre 200):**
```json
{"message": "Se o e-mail estiver cadastrado, enviaremos instruções de redefinição."}
```

**O que fazer no frontend:**
- **NÃO distinguir** entre email encontrado e não encontrado.
- Sempre mostrar mensagem de sucesso genérica para o usuário.
- Se o frontend atualmente verifica `status === 404`, remover essa lógica.

### 3. Password Validation — Respostas de erro adicionais
**O que mudou:** `ChangePasswordView` e `ResetPasswordView` agora validam a força da senha usando os validators do Django.

**Nova resposta de erro possível (400):**
```json
{
    "detail": [
        "This password is too short. It must contain at least 8 characters.",
        "This password is too common."
    ]
}
```

**O que fazer no frontend:**
- No `ChangePasswordView`: Se a API retornar 400, verificar se `detail` é uma **array de strings** (múltiplas mensagens de validação).
- Exibir todas as mensagens de validação para o usuário.
- Considerar adicionar validação local de senha mínima (8 caracteres) para evitar roundtrips.

### 4. Rate Limiting — Novos endpoints limitados
**O que mudou:** Estes endpoints agora têm rate limiting por IP:

| Endpoint | Limite |
|----------|--------|
| `POST /api/accounts/login/` | 10 req/min |
| `POST /api/accounts/resend-verification/` | 3 req/min |
| `POST /api/accounts/forgot-password/` | 5 req/min |

**Resposta quando limitado (429):**
```
HTTP 429 Too Many Requests
```

**O que fazer no frontend:**
- Tratar status 429 mostrando mensagem tipo "Muitas tentativas. Tente novamente em 1 minuto."
- Considerar desabilitar o botão de submit temporariamente após receber 429.

### 5. ClaimGuestView — Mensagem de erro genérica
**O que mudou:** Erros inesperados no claim de sessão agora retornam mensagem genérica em vez de detalhes internos.

**Antes:** `{"detail": "DatabaseError: connection refused..."}`
**Depois:** `{"detail": "Erro ao processar sessão."}`

**Impacto no frontend:** Nenhum — a lógica de tratamento de erro deve continuar funcionando. Apenas a mensagem foi higienizada.

---

## ⚠️ MUDANÇAS NÃO IMPLEMENTADAS (por design)

| Item | Motivo |
|------|--------|
| **M6** — threading.Thread para background tasks | Requer refatoração significativa da arquitetura. Mover para Cloud Tasks em sprint dedicado. |
| **H3** — Rate limiting de Guest Sessions | Complexo — requer middleware customizado ou mudança no auth flow. Recomendo resolver em sprint separado. |
| **L3** — JWT lifetime 60→30 min | Pode impactar UX do app mobile. Avaliar com time de frontend. |
| **L4** — Soft-delete de conta | Requer novo campo no model + nova migration. Fazer em sprint dedicado. |

---

*Relatório gerado em 2026-02-23. Todas as mudanças foram validadas com `manage.py check`.*
