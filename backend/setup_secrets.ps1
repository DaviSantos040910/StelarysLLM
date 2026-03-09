# ==============================================================================
# setup_secrets.ps1 - Gerenciador de Secrets do Stellarys IA
# ==============================================================================
# Este script cria ou atualiza os secrets no GCP Secret Manager e vincula
# automaticamente ao Serviço e ao Job de Migration do Cloud Run.
# ==============================================================================

$PROJECT = "stellarys-lm"
$REGION = "us-central1"
$SERVICE = "backend-api"
$MIGRATE_JOB = "backend-migrate"
$SA = "stellarys-backend@stellarys-lm.iam.gserviceaccount.com"

# --- CONFIGURAÇÃO DOS VALORES ---
# Agora os valores são carregados do arquivo .env.secrets (ignorado pelo Git)
$SECRETS_FILE = "$PSScriptRoot\.env.secrets"
$SECRETS = @{}

if (Test-Path $SECRETS_FILE) {
    Write-Host "--- Carregando segredos de .env.secrets" -ForegroundColor Gray
    Get-Content $SECRETS_FILE | Where-Object { $_ -match "=" } | ForEach-Object {
        $parts = $_ -split "=", 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim().Trim('"').Trim("'")
        $SECRETS[$key] = $val
    }
}
else {
    Write-Host "!!! ATENÇÃO: Arquivo .env.secrets não encontrado!" -ForegroundColor Red
    Write-Host "Crie o arquivo baseado no seu backup para que o script funcione." -ForegroundColor Yellow
}

function Ensure-Secret($name, $value) {
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "--- Pulando $name (valor vazio)" -ForegroundColor Yellow
        return
    }

    gcloud secrets describe $name --project=$PROJECT *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "+++ Criando secret: $name" -ForegroundColor Green
        $value | gcloud secrets create $name --data-file=- --project=$PROJECT
    }
    else {
        Write-Host ">>> Atualizando secret: $name (nova versão)" -ForegroundColor Cyan
        $value | gcloud secrets versions add $name --data-file=- --project=$PROJECT
    }
}

Write-Host "`n1) Sincronizando Secrets com Secret Manager..." -ForegroundColor White -BackgroundColor Blue
foreach ($name in $SECRETS.Keys) {
    Ensure-Secret $name $SECRETS[$name]
}

Write-Host "`n2) Garantindo permissões para a Service Account..." -ForegroundColor White -BackgroundColor Blue
gcloud projects add-iam-policy-binding $PROJECT `
    --member="serviceAccount:$SA" `
    --role="roles/secretmanager.secretAccessor" `
    --condition=None

Write-Host "`n3) Vinculando Secrets ao Cloud Run Service ($SERVICE)..." -ForegroundColor White -BackgroundColor Blue
# NOTA: Removemos as env vars de mesmo nome antes de setar como secrets para evitar conflito de tipos
gcloud run services update $SERVICE `
    --project=$PROJECT `
    --region=$REGION `
    --remove-env-vars "DJANGO_SECRET_KEY,DATABASE_URL,CLOUD_TASKS_SECRET,SENDGRID_API_KEY,GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,SENTRY_DSN" `
    --set-secrets "`
DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest,`
DATABASE_URL=DATABASE_URL:latest,`
CLOUD_TASKS_SECRET=CLOUD_TASKS_SECRET:latest,`
SENDGRID_API_KEY=SENDGRID_API_KEY:latest,`
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:latest"

Write-Host "`n4) Vinculando Secrets ao Migration Job ($MIGRATE_JOB)..." -ForegroundColor White -BackgroundColor Blue
gcloud run jobs update $MIGRATE_JOB `
    --project=$PROJECT `
    --region=$REGION `
    --remove-env-vars "DJANGO_SECRET_KEY,DATABASE_URL,CLOUD_TASKS_SECRET" `
    --set-secrets "`
DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest,`
DATABASE_URL=DATABASE_URL:latest,`
CLOUD_TASKS_SECRET=CLOUD_TASKS_SECRET:latest"

Write-Host "`nFinalizado com sucesso! Todos os secrets foram sincronizados e vinculados." -ForegroundColor Green
