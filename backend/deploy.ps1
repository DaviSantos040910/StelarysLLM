# Deploy backend API to Cloud Run
# Secrets are injected from GCP Secret Manager via --set-secrets

gcloud run deploy backend-api `
  --source . `
  --region us-central1 `
  --project stellarys-lm `
  --service-account stellarys-backend@stellarys-lm.iam.gserviceaccount.com `
  --add-cloudsql-instances stellarys-lm:us-central1:stellarys-db `
  --env-vars-file env.prod.yaml `
  --set-secrets "DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest,DATABASE_URL=DATABASE_URL:latest,SENDGRID_API_KEY=SENDGRID_API_KEY:latest,CLOUD_TASKS_SECRET=CLOUD_TASKS_SECRET:latest,SENTRY_DSN=SENTRY_DSN:latest,GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:latest"

$IMAGE = gcloud run services describe backend-api `
  --region us-central1 `
  --project stellarys-lm `
  --format="value(spec.template.spec.containers[0].image)"

gcloud run jobs update backend-migrate `
  --region us-central1 `
  --project stellarys-lm `
  --image $IMAGE `
  --set-secrets "DJANGO_SECRET_KEY=DJANGO_SECRET_KEY:latest,DATABASE_URL=DATABASE_URL:latest"

gcloud run jobs execute backend-migrate `
  --region us-central1 `
  --project stellarys-lm