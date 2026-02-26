# 🛡️ Backend Audit Report — Stellarys IA Robots

**Date:** 2026-02-18
**Scope:** Read-only comprehensive audit — Security, Performance, Production Config, Dead Code, Dependencies, Sentry, Cloud Run
**Status:** No code changes made

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [🔴 CRITICAL — Must Fix Before Production](#2--critical--must-fix-before-production)
3. [🟠 HIGH — Fix Soon](#3--high--fix-soon)
4. [🟡 MEDIUM — Recommended Improvements](#4--medium--recommended-improvements)
5. [🟢 LOW — Nice to Have](#5--low--nice-to-have)
6. [Dead Code & Unused Imports](#6-dead-code--unused-imports)
7. [Dependency Review](#7-dependency-review)
8. [Sentry Integration Plan](#8-sentry-integration-plan)
9. [Cloud Run Readiness Checklist](#9-cloud-run-readiness-checklist)
10. [Architecture Notes](#10-architecture-notes)

---

## 1. Executive Summary

The backend is a **Django 5.1 + DRF** application deployed on **Google Cloud Run**, backed by **PostgreSQL (Cloud SQL)**, **Google Cloud Storage**, **Google Cloud Tasks**, and **Gemini AI (Vertex AI)**. It serves a mobile app (React Native/Expo) for chat, study tools, and AI-powered artifact generation.

**Overall Assessment:** The application is **functionally solid** with a well-structured billing/quota system and thoughtful AI integration. However, there are **critical security gaps in production configuration** and several opportunities for performance hardening that must be addressed before wider rollout.

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 5 | 4 | 3 | 2 |
| Performance | 0 | 2 | 4 | 1 |
| Production Config | 3 | 2 | 2 | 0 |
| Observability | 0 | 1 | 2 | 1 |
| Code Quality | 0 | 1 | 3 | 2 |

---

## 2. 🔴 CRITICAL — Must Fix Before Production

### C1. `SECRET_KEY` Fallback to Insecure Default
**File:** `config/settings.py:43`
```python
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret")
```
**Risk:** If `DJANGO_SECRET_KEY` is not set in production, the application uses `"dev-secret"` as the signing key for JWT tokens, CSRF tokens, and sessions. An attacker who knows this default can forge any token.
**Also noted:** `env.prod.yaml` hardcodes `DJANGO_SECRET_KEY: Darth_S%40antos1931%23` — this file is in the repository and can be read by anyone with access.
**Fix:** Use a secret manager (GCP Secret Manager) or Cloud Run secrets. **Remove hardcoded secrets from yaml files in git.** Ensure the app **crashes** on startup if `DJANGO_SECRET_KEY` is missing.

### C2. `ALLOWED_HOSTS = ["*"]`
**File:** `config/settings.py:45`
```python
ALLOWED_HOSTS = ["*"]  # Change in production
```
**Risk:** Allows **HTTP Host header injection attacks**, which can lead to cache poisoning, password reset link hijacking, and phishing. Django's Host header validation is one of its most effective security features.
**Fix:** Set `ALLOWED_HOSTS` from an environment variable, e.g.:
```python
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost").split(",")
```
In production, set to your Cloud Run domain: `backend-api-xxxxx-uc.a.run.app`

### C3. `CORS_ALLOW_ALL_ORIGINS = True`
**File:** `config/settings.py:161`
```python
CORS_ALLOW_ALL_ORIGINS = True
```
**Risk:** Any website can make authenticated API calls on behalf of your users if they have valid tokens. Combined with JWT in headers (not cookies), the risk is somewhat mitigated but not eliminated — especially for any cookie-based sessions (admin panel).
**Fix:** Set to `False` and populate `CORS_ALLOWED_ORIGINS` with your actual frontend domain(s).

### C4. Missing SSL/HTTPS Security Headers
**Files:** `config/settings.py` — These settings are completely absent:
```python
# NOT configured anywhere:
SECURE_PROXY_SSL_HEADER  # Required for Cloud Run (terminates TLS at load balancer)
SECURE_SSL_REDIRECT
SESSION_COOKIE_SECURE
CSRF_COOKIE_SECURE
SECURE_HSTS_SECONDS
SECURE_BROWSER_XSS_FILTER
SECURE_CONTENT_TYPE_NOSNIFF
```
**Risk:** Cloud Run terminates TLS at the proxy. Without `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`, Django thinks all requests are HTTP, breaking HTTPS-only logic and making redirects insecure.
**Fix:** Add these settings gated behind `not DEBUG`:
```python
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_CONTENT_TYPE_NOSNIFF = True
```

### C5. Secrets Committed to Git (`env.prod.yaml`)
**File:** `env.prod.yaml`
This file contains:
- `DJANGO_SECRET_KEY`
- `SENDGRID_API_KEY`
- `DATABASE_URL` (with password)
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (full JSON)

**Risk:** Anyone with repo access has production credentials. If the repo is ever made public or leaked, **all production secrets are compromised**.
**Fix:** Move ALL secrets to **GCP Secret Manager** and reference them in Cloud Run service config. Remove `env.prod.yaml` from git and add it to `.gitignore`. Rotate all current secrets immediately.

---

## 3. 🟠 HIGH — Fix Soon

### H1. `print()` Statement Leaking Config Data on Startup
**File:** `config/settings.py:22`
```python
print("SENDGRID_SENDER =", os.getenv("SENDGRID_SENDER"))
```
**Risk:** Leaks the SendGrid sender email to stdout on every request worker startup in Cloud Run. This data is then visible in **Cloud Logging** to anyone with log access. Not catastrophic, but poor practice and may expose PII.
**Fix:** Remove this line entirely, or replace with a `logger.debug()` call gated behind `DEBUG`.

### H2. Internal Endpoints with `AllowAny` Permission
**Files:**
- `studio/views_internal.py:20` — `ArtifactGenerationTaskView`
- `chat/views_internal.py:16` — `IngestionTaskView`

Both use `permission_classes = [permissions.AllowAny]` with custom secret-based auth:
```python
if env_secret and secret_header != env_secret:
    return Response({"error": "Unauthorized"}, status=403)
```
**Risk:** If `CLOUD_TASKS_SECRET` is not set in the environment, the secret check **passes** because `env_secret` is falsy. This means in environments where the secret isn't configured, **anyone can hit these endpoints**.
**Fix:** Fail closed — if the secret env var is not set in production, **reject all requests**:
```python
if not env_secret:
    if not settings.DEBUG:
        return Response({"error": "Unauthorized: No secret configured"}, status=403)
```

### H3. Guest Session Auto-Creation is Unauthenticated
**File:** `accounts/authentication.py:41`
```python
session, created = GuestSession.objects.get_or_create(id=uuid_obj)
```
**Risk:** Any client can create unlimited guest sessions by sending unique `X-Guest-Id` UUIDs. Each session gets a full trial (90 messages, artifacts, etc.). This is a **trial abuse vector** — an automated script could generate thousands of guest sessions.
**Fix:** Implement rate limiting on guest session creation (e.g., per IP) and/or require a device fingerprint that's harder to forge.

### H4. Exception Messages Exposed to Clients
**Files:**
- `accounts/views.py:187` — `ClaimGuestView`: `Response({"detail": str(e)}, ...)`
- `studio/views_internal.py:89`: `Response({"error": str(e)}, ...)`
- `chat/views_internal.py:52`: `Response({"error": str(e)}, ...)`

**Risk:** `str(e)` on unhandled exceptions can expose internal stack trace details, file paths, database table names, or SQL queries. This is information leakage.
**Fix:** Return generic error messages to clients. Log the full exception server-side with `logger.error(exc_info=True)`.

---

## 4. 🟡 MEDIUM — Recommended Improvements

### M1. No Upload File Size/Type Validation
**Files:** `chat/views.py` (attachment upload), `studio/views.py` (source upload)
**Current state:** Django's default `FILE_UPLOAD_MAX_MEMORY_SIZE` (2.5 MB) applies, but `DATA_UPLOAD_MAX_MEMORY_SIZE` is not configured. There is no explicit file type or size validation on upload endpoints.
**Risk:** Users could upload very large files that consume memory/disk, or upload executable/malicious files.
**Fix:** Add explicit `MAX_FILE_SIZE` checks in serializers/views and whitelist allowed MIME types. Configure `DATA_UPLOAD_MAX_MEMORY_SIZE` in settings.

### M2. `DEBUG` Defaults to `True`
**File:** `config/settings.py:44`
```python
DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"
```
**Risk:** If `DJANGO_DEBUG` is not explicitly set to `"False"` in production, Django runs in debug mode — full error pages with stack traces, SQL queries, and settings values are shown to all users.
**Fix:** Default to `False`:
```python
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"
```

### M3. `ChangePasswordView` — No Minimum Length Enforcement
**File:** `accounts/views.py:132-148`
```python
def post(self, request):
    ...
    user.set_password(new_password)  # No validation!
```
**Risk:** Users can set trivially weak passwords when changing their password. The `RegisterSerializer` uses `validate_password()`, but the change password flow does not.
**Fix:** Add `validate_password(new_password, user)` before `set_password()`.

### M4. `ResetPasswordView` — No Minimum Password Validation
**File:** `accounts/views.py:253-276`
Same issue as M3 — the password reset flow sets the password without Django's validators.

### M5. `Gunicorn --timeout 0`
**File:** `Dockerfile:42`
```
CMD exec gunicorn --bind :$PORT --workers 2 --threads 8 --timeout 0 config.wsgi:application
```
**Risk:** `--timeout 0` means workers **never time out**. A hung request (e.g., waiting on a Gemini API call that hangs) will tie up that worker forever, eventually exhausting all workers. Cloud Run has its own timeout (default 300s), but the worker itself will be stuck.
**Fix:** Set `--timeout 120` (or similar). Cloud Run's maximum request timeout is configurable separately and provides a second layer of defense.

### M6. `threading.Thread` for Background Tasks in Production
**Files:** `chat/services/chat_service.py:459`, `:764`, `:993`, `:1151`
```python
threading.Thread(target=process_memory_background, args=(...)).start()
```
**Risk:** Gunicorn with `--threads 8` uses actual OS threads. Spawning additional daemon threads for background work (memory processing, summarization) is risky because:
1. Cloud Run can kill the container after the response is sent, killing your background threads mid-work.
2. No error handling — if the thread crashes, nobody knows.
**Fix:** Move background work to Cloud Tasks (which you already have infrastructure for) or use a proper task queue.

### M7. `ForgotPasswordView` Reveals User Existence
**File:** `accounts/views.py:208-209`
```python
except User.DoesNotExist:
    return Response({"detail": "Usuário não encontrado."}, status=404)
```
**Risk:** An attacker can enumerate which email addresses are registered by observing 404 vs 200 responses.
**Fix:** Always return the same success message regardless of whether the user was found.

---

## 5. 🟢 LOW — Nice to Have

### L1. `LoginView` — No Rate Limiting
**File:** `accounts/views.py:81-107`
`RegisterView` has `@ratelimit(key="ip", rate="5/m")`, but `LoginView` does not.
**Fix:** Add rate limiting to prevent brute-force credential attacks.

### L2. `ResendVerificationView` — No Rate Limiting
**File:** `accounts/views.py:64-78`
Can be used to spam verification emails to users.

### L3. JWT Access Token Lifetime is 60 Minutes
**File:** `config/settings.py:152`
```python
"ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
```
This is reasonable for a mobile app but on the longer side. Consider 30 minutes with a proper refresh flow.

### L4. `MeView.delete` — Instant Account Deletion
**File:** `accounts/views.py:126-129`
No confirmation step, no soft-delete, no data export. `user.delete()` cascades and removes ALL data permanently.

### L5. `GCS default_acl` Set to String `"None"` Instead of Python `None`
**File:** `config/settings.py:245`
```python
"default_acl": "None",  # String, not Python None
```
This should be `None` (Python object) to use the bucket's default ACL. The string `"None"` may cause unexpected behavior with `django-storages`.

---

## 6. Dead Code & Unused Imports

### Files That Can Be Removed/Cleaned

| File | Issue | Action |
|------|-------|--------|
| `config/test_streaming.py` | Test/debug script, ~117 lines of `print()` statements. Not a test case — pure debug exploration. | **Remove** from production image |
| `config/list_models.py` | Debug script to list available Gemini models | **Remove** from production image |
| `chat/services/token_service.py` | Defined `TokenService` class with `estimate_tokens()` and `truncate_to_token_limit()`. **Not imported anywhere else in the codebase.** | **Mark for removal** or integrate if needed |
| `chat/services/intent_service.py` | Has `IntentService.is_sources_list_intent()`. Functionality is also duplicated in `strict_boundary.py`. | **Review for consolidation** |
| `.env` in `.gitignore` | `.env` is correctly in `.gitignore` ✅ | OK |
| `env.prod.yaml` | **NOT in `.gitignore`** — contains production secrets | Add to `.gitignore` and remove from repo |

### Unused Import Candidates
The `accounts/urls.py` imports `ratelimit` from `django_ratelimit.decorators` at the module level but never uses it (rate limiting is applied via `@method_decorator` inside views, not in urls).

### Dead Artifact Runner Debug Helper
**File:** `studio/services/artifact_runner.py:22-23`
```python
def _p(msg):
    print(msg, flush=True)
```
Used extensively (~20+ calls) for debug print output. Should be converted to `logger.info()` for production, or gated behind a verbosity flag.

---

## 7. Dependency Review

### `requirements.txt` Analysis

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| Django | 5.1.5 | ⚠️ | Django 5.1 is current, but version is pinned well — good. Check for security patches. |
| djangorestframework | 3.16.1 | ✅ | Up to date |
| google-genai | ≥0.3.0 | ⚠️ | **Unpinned ceiling**. Tests showed `AttributeError: OBJECT` with newer versions. **Pin to specific version** (e.g., `google-genai==0.8.x`). |
| chromadb | Not pinned | ⚠️ | Should pin version for reproducible builds |
| pypdf | Not pinned | ⚠️ | Pin version |
| weasyprint | Not pinned | ⚠️ | Major version changes can break PDF rendering |
| yt-dlp | Not pinned | ⚠️ | Frequently updated, sometimes with breaking changes |
| pydub | Not pinned | ✅ | Stable library, low risk |
| pillow | 11.1.0 | ✅ | Pinned, good |
| gunicorn | Not pinned | ⚠️ | Pin for reproducibility |
| pgvector | Not pinned | ⚠️ | Pin |
| `audioop-lts` | conditional | ✅ | Good — needed for Python 3.13+ |

### Libraries Installed But Possibly Underused

| Library | Used? | Notes |
|---------|-------|-------|
| `django-ratelimit` | Partially | Only used on `RegisterView`. Not on `LoginView`, `ForgotPasswordView`, or any API endpoint. |
| `beautifulsoup4` | Likely | Used by content extractor for URL parsing |
| `trafilatura` | Likely | Used for web content extraction |
| `pymupdf4llm` | Likely | PDF parsing for RAG |
| `rq` + `django-rq` | Configured | RQ is configured in settings but **`QUEUE_BACKEND` defaults to `'thread'` in production** — meaning RQ is installed but potentially unused if Cloud Tasks is the actual backend. |

### Recommendations
1. **Pin ALL dependencies** to exact versions (`==`) in `requirements.txt`
2. **Run `pip audit`** (or `safety check`) to identify known CVEs
3. Consider a `requirements.lock` or use `pip-compile` for deterministic builds
4. **google-genai**: Pin to the exact version that passed tests to avoid `AttributeError: OBJECT` regressions

---

## 8. Sentry Integration Plan

Sentry is **not currently integrated** — there are zero references to Sentry in the codebase.

### Recommended Integration Points

#### 8.1 Global Setup (`config/settings.py`)
```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

if not DEBUG:
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[
            DjangoIntegration(
                transaction_style="url",
                middleware_spans=True,
            ),
            LoggingIntegration(
                level=logging.INFO,        # Capture info+ as breadcrumbs
                event_level=logging.ERROR,  # Send errors as events
            ),
        ],
        traces_sample_rate=0.1,  # 10% APM sampling
        profiles_sample_rate=0.1,
        send_default_pii=False,  # GDPR-safe
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
    )
```

#### 8.2 Custom Exception Handler (`billing/api/exceptions.py`)
Add `sentry_sdk.capture_exception()` in `custom_exception_handler` for non-quota errors:
```python
def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if not isinstance(exc, QuotaExceededException):
        sentry_sdk.capture_exception(exc)
    ...
```

#### 8.3 AI Service Errors (`chat/services/chat_service.py`)
Key capture points:
- Line 479: `except Exception as e:` in `get_ai_response` — captures all AI failures
- Line 1001: `except Exception as e:` in `process_message_stream` — SSE stream failures
- `strict_style_service.py`, `memory_service.py`, `evidence_tiebreaker_ai.py` — all catch generic exceptions

#### 8.4 Artifact Runner Errors (`studio/services/artifact_runner.py`)
- Line 110: `except Exception as e:` — captures all artifact generation failures
- Should tag with `artifact_id`, `artifact_type`, and `job_id` for filtering

#### 8.5 Cloud Tasks Internal Endpoints
- `studio/views_internal.py:87` and `chat/views_internal.py:50` — capture task execution failures

#### 8.6 Background Threads
- `_summarize_chat_history_background` (line 1155)
- `process_memory_background` — these run in threads where unhandled exceptions are **silently swallowed**. Sentry capture is critical here.

### Required Package
Add to `requirements.txt`:
```
sentry-sdk[django]==2.x.x
```

---

## 9. Cloud Run Readiness Checklist

| Check | Status | Notes |
|-------|--------|-------|
| `DEBUG=False` in prod | ✅ | Set in `env.prod.yaml` |
| `SECRET_KEY` from env | ⚠️ | Has fallback to `"dev-secret"` |
| `ALLOWED_HOSTS` restricted | ❌ | Currently `["*"]` |
| `CORS` restricted | ❌ | `CORS_ALLOW_ALL_ORIGINS = True` |
| `SECURE_PROXY_SSL_HEADER` | ❌ | Not configured — required for Cloud Run |
| Health check endpoint | ❌ | No `/healthz` or `/readyz` endpoint exists |
| `collectstatic` | ⚠️ | Commented out in Dockerfile |
| Graceful shutdown | ⚠️ | `--timeout 0` in Gunicorn; background threads may be killed |
| Database connection pooling | ✅ | `conn_max_age=600`, `conn_health_checks=True` |
| Env-based backend config | ✅ | `STORAGE_BACKEND`, `QUEUE_BACKEND`, `VECTOR_DB_BACKEND` |
| Migrations via separate job | ✅ | `deploy.ps1` runs a separate Cloud Run Job |
| Container size | ⚠️ | `ffmpeg`, `weasyprint` deps add ~200MB+ to image |
| Cold start | ⚠️ | `ImageGenerationService` was fixed for lazy init, but AI client creation still happens at import time for `ai_client.py` module-level constants |
| Memory usage | ⚠️ | Streaming SSE + PDF generation + audio mixing can spike memory |
| Secret management | ❌ | Secrets in `env.prod.yaml` file, not GCP Secret Manager |
| Logging to Cloud Logging | ✅ | `PYTHONUNBUFFERED=1` + print/logger output goes to stdout |

### Recommended Health Check Endpoint
Add to `config/urls.py`:
```python
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path('healthz/', health_check, name='health-check'),
    # ... rest of urls
]
```

---

## 10. Architecture Notes

### Strengths ✅
1. **Clean separation of concerns** — Services layer (`chat/services/`, `billing/services/`, `studio/services/`) is well-organized.
2. **Dual backend pattern** — `QUEUE_BACKEND`, `STORAGE_BACKEND`, `VECTOR_DB_BACKEND` allow seamless dev/prod switching.
3. **Robust billing/quota system** — Atomic operations with `select_for_update()`, race condition protection, and per-resource limits.
4. **AI model centralization** — `core/genai_models.py` constants prevent hardcoded model names scattered across the codebase.
5. **Persona Guard & Stream Sanitizer** — AI identity leak protection is a sophisticated and valuable feature.
6. **Entitlements system** — Clean `get_entitlements()` flow that resolves user permissions dynamically.

### Concerns ⚠️
1. **`chat_service.py` is 1,195 lines** — This file is the "God object" of the codebase. It handles sync responses, streaming, voice messages, summarization, and context fetching. Consider splitting into focused modules.
2. **Duplicated auth logic** — `StreamChatMessageView._authenticate()` and `RegenerateMessageView._authenticate()` are nearly identical copies. Should be extracted to a shared utility.
3. **No database indexes visually confirmed** — The queryset patterns (filtering by `user`, `bot`, `status`, `chat_id`) likely need composite indexes for performance at scale. Run `EXPLAIN ANALYZE` on frequent queries.
4. **No N+1 query protection** — Views like `KnowledgeSourceViewSet`, `KnowledgeArtifactViewSet`, and `ActiveChatListView` don't use `select_related()` or `prefetch_related()`. This will cause performance issues as the database grows.
5. **`Subscription` accessed via `user.subscription`** — This is a `OneToOneField` and will throw `RelatedObjectDoesNotExist` if no subscription exists. Multiple places use `hasattr(user, 'subscription')` which catches this, but it's fragile.

---

## Summary of Priority Actions

### Immediate (Before Next Deploy)
1. **C5** — Remove `env.prod.yaml` from git, move secrets to GCP Secret Manager
2. **C1** — Remove `SECRET_KEY` fallback; crash on missing key
3. **C2** — Restrict `ALLOWED_HOSTS` via env var
4. **C4** — Add `SECURE_PROXY_SSL_HEADER` and related settings
5. **H1** — Remove `print("SENDGRID_SENDER =", ...)` from settings

### This Sprint
6. **C3** — Restrict CORS
7. **H2** — Fix internal endpoint auth (fail closed)
8. **M2** — Default `DEBUG` to `False`
9. **M5** — Set Gunicorn timeout
10. Pin all dependency versions in `requirements.txt`

### Next Sprint
11. Add Sentry integration (Section 8)
12. Add health check endpoint
13. Add rate limiting to `LoginView` and `ForgotPasswordView`
14. Fix password validation in `ChangePasswordView` and `ResetPasswordView`
15. Add file upload size/type validation
16. Remove debug scripts (`config/test_streaming.py`, `config/list_models.py`)

---

*This report was generated through a read-only audit of the codebase. No files were modified.*
