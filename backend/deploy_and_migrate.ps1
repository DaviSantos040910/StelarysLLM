# ==============================================================================
# deploy_and_migrate.ps1 - Fluxo Completo de Atualização de Código
# ==============================================================================
# 1. Faz o build e deploy do novo código para o Cloud Run
# 2. Sincroniza a imagem do Job de Migration
# 3. Executa as migrações automaticamente
# ==============================================================================

$PROJECT = "stellarys-lm"
$REGION = "us-central1"
$SERVICE = "backend-api"
$MIGRATE_JOB = "backend-migrate"

Write-Host "`n🚀 Iniciando Deploy do Código..." -ForegroundColor Cyan

# 1. Deploy do Service (Build e Update)
gcloud run deploy $SERVICE `
    --source . `
    --region $REGION `
    --project $PROJECT `
    --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Erro no Deploy. Abortando." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n🔄 Sincronizando Imagem com o Job de Migration..." -ForegroundColor Cyan

# 2. Pegar a imagem mais recente do Service
$IMAGE = (gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format="value(spec.template.spec.containers[0].image)").Trim()

# 3. Atualizar o Job com essa imagem
gcloud run jobs update $MIGRATE_JOB `
    --image $IMAGE `
    --region $REGION `
    --project $PROJECT

Write-Host "`n⚖️ Executando Migrações no Banco de Dados..." -ForegroundColor Cyan

# 4. Executar o Job
gcloud run jobs execute $MIGRATE_JOB `
    --region $REGION `
    --project $PROJECT `
    --wait

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Sucesso Total! Código atualizado e Migrations aplicadas." -ForegroundColor Green
}
else {
    Write-Host "`n⚠️ O Deploy funcionou, mas as Migrations falharam. Verifique os logs." -ForegroundColor Yellow
}
