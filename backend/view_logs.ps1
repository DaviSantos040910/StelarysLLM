# ==============================================================================
# view_logs.ps1 - Visualizador de Logs em Tempo Real
# ==============================================================================

$PROJECT = "stellarys-lm"
$REGION = "us-central1"
$SERVICE = "backend-api"

Write-Host "`n👀 Mostrando as últimas 50 linhas do servidor $SERVICE...`n" -ForegroundColor Cyan

gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" --limit 50 --project $PROJECT --format="table(timestamp,textPayload)"

Write-Host "`n💡 Dica: Para ver logs em tempo real sem scripts, use o Console do Google Cloud: https://console.cloud.google.com/run/detail/$REGION/$SERVICE/logs?project=$PROJECT" -ForegroundColor Gray
