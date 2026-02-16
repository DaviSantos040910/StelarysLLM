# Guia de Implantação e Configuração (Cloud Run + Google Cloud Tasks)

Este guia detalha como configurar a infraestrutura para a nova arquitetura dual (Dev/Prod) implementada.

## 1. Google Cloud Storage (GCS)

Para armazenamento de arquivos (PDFs, Áudios, Imagens) em produção.

1.  **Criar Bucket:**
    *   Crie um bucket no GCS (ex: `meu-app-media-prod`).
    *   Desmarque "Enforce public access prevention" se precisar que arquivos sejam públicos, ou configure URLs assinadas (o código atual suporta URLs assinadas via `django-storages`).
2.  **Permissões:**
    *   Crie uma Service Account (SA) para o backend.
    *   Dê a role `Storage Object Admin` no bucket para essa SA.

## 2. Google Cloud SQL (PostgreSQL + PGVector)

Para banco de dados relacional e vetorial em produção.

1.  **Criar Instância:**
    *   Crie uma instância Cloud SQL para PostgreSQL (versão 15+ recomendada).
2.  **Ativar Extensão `vector`:**
    *   Conecte-se ao banco e execute: `CREATE EXTENSION IF NOT EXISTS vector;`
3.  **Criar Banco e Usuário:**
    *   Crie o DB e as credenciais.
4.  **Connection Name:**
    *   Anote o `INSTANCE_CONNECTION_NAME` (ex: `project:region:instance`).

## 3. Google Cloud Tasks

Para processamento assíncrono (geração de artefatos, ingestão de YouTube) sem Redis.

1.  **Habilitar API:**
    *   Habilite a "Cloud Tasks API".
2.  **Criar Filas:**
    *   Crie duas filas na região do seu deploy:
        *   `default` (para tarefas gerais)
        *   `ingestion` (para tarefas pesadas/longas)
    ```bash
    gcloud tasks queues create default --location=us-central1
    gcloud tasks queues create ingestion --location=us-central1
    ```
3.  **Segurança (HMAC):**
    *   Gere uma string aleatória forte para ser o `CLOUD_TASKS_SECRET`.
    *   O Cloud Tasks enviará esse segredo no header `X-CloudTasks-Secret` para autenticar a chamada no seu backend.

## 4. Vertex AI

Para geração de texto e embeddings em produção.

1.  **Habilitar API:**
    *   Habilite a "Vertex AI API".
2.  **Permissões:**
    *   A Service Account do Cloud Run precisa da role `Vertex AI User`.

## 5. Deploy no Cloud Run

### Variáveis de Ambiente (ENV)

Configure as seguintes variáveis no seu serviço Cloud Run:

| Variável | Valor Exemplo | Descrição |
| :--- | :--- | :--- |
| `DJANGO_SETTINGS_MODULE` | `backend.settings` | Módulo de settings |
| `DEBUG` | `False` | Desativa debug em prod |
| `SECRET_KEY` | `(sua_secret_key)` | Chave do Django |
| `DATABASE_URL` | `postgres://user:pass@/dbname?host=/cloudsql/project:region:instance` | Conexão via Socket Unix |
| `GS_BUCKET_NAME` | `meu-app-media-prod` | Nome do bucket GCS |
| `QUEUE_BACKEND` | `cloud_tasks` | Ativa Cloud Tasks |
| `STORAGE_BACKEND` | `gcs` | Ativa GCS |
| `VECTOR_DB_BACKEND` | `pgvector` | Ativa PGVector |
| `AI_PROVIDER` | `vertex` | (Opcional) Se usar Vertex em vez de API Key |
| `GEMINI_API_KEY` | `(chave)` | Se usar API Key direta |
| `CLOUD_TASKS_PROJECT_ID` | `meu-projeto-id` | ID do projeto GCP |
| `CLOUD_TASKS_LOCATION` | `us-central1` | Região das filas |
| `CLOUD_TASKS_QUEUE_NAME` | `default` | Fila padrão |
| `CLOUD_TASKS_INGESTION_QUEUE_NAME` | `ingestion` | Fila de ingestão |
| `CLOUD_TASKS_SECRET` | `(seu_token_secreto)` | Token para validar tasks |
| `CLOUD_TASKS_TARGET_URL` | `https://seu-backend.run.app` | URL pública do serviço |

### Comandos de Deploy

1.  **Build:**
    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/backend .
    ```
2.  **Deploy:**
    ```bash
    gcloud run deploy backend \
      --image gcr.io/PROJECT_ID/backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE \
      --set-env-vars ... (vars acima)
    ```

3.  **Migrate (Pós-Deploy):**
    *   Execute as migrações no banco de produção. Você pode usar um Job do Cloud Run ou conectar via proxy localmente.
    ```bash
    # Exemplo via Job
    gcloud run jobs create migrate --image gcr.io/PROJECT_ID/backend --command python,manage.py,migrate ...
    gcloud run jobs execute migrate
    ```

## 6. Validação

1.  **Health Check:** Acesse `/health` (se existir) ou a raiz.
2.  **Upload:** Tente fazer upload de um PDF. Verifique se aparece no Bucket GCS.
3.  **Geração:** Peça para gerar um artefato.
    *   Verifique os logs do Cloud Run.
    *   Você deve ver a requisição chegando em `/api/v1/studio/jobs/task_handler/`.
4.  **Ingestão:** Adicione um link do YouTube.
    *   Verifique se a tarefa foi para a fila `ingestion` no Console do Cloud Tasks.

## Observações Importantes

*   **Idempotência:** O handler de tasks (`ArtifactTaskView`) implementa verificação básica de status para evitar re-execução se o Cloud Tasks tentar entregar a mensagem novamente.
*   **Timeouts:** O Cloud Run tem timeout padrão de 5 min (configurável até 60 min). Para geração de podcasts longos, aumente o timeout do serviço.
*   **Worker vs Web:** Nesta arquitetura, o próprio container Web processa as tasks via HTTP POST. Não é necessário um container "worker" separado (como no Celery/RQ), o que economiza custos.
