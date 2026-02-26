# ==============================================================================
# update_env.ps1 - Atualização Rápida de Configurações
# ==============================================================================
# Atualiza as variáveis de ambiente e segredos sem fazer rebuild do código.
# ==============================================================================

$PROJECT = "stellarys-lm"
$REGION = "us-central1"
$SERVICE = "backend-api"
$MIGRATE_JOB = "backend-migrate"

Write-Host "`n🔧 Atualizando Configurações (Env Vars e Secrets)..." -ForegroundColor Cyan

# 1. Primeiro rodamos o script de secrets para garantir que o Secret Manager está em dia
.\setup_secrets.ps1

Write-Host "`n♻️ Aplicando alterações nos Serviços Cloud Run..." -ForegroundColor Cyan

# O Cloud Run criará uma nova revisão automaticamente ao atualizar os secrets/env vars
# Este comando garante que ambos (Service e Job) usem o DATABASE_URL:latest e outras envs

# Update Service
gcloud run services update $SERVICE `
    --region $REGION `
    --project $PROJECT `
    --env-vars-file env.prod.yaml

# Update Job
gcloud run jobs update $MIGRATE_JOB `
    --region $REGION `
    --project $PROJECT

Write-Host "`n✨ Configurações atualizadas com sucesso!" -ForegroundColor Green
