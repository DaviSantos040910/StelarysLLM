import threading
import json
import logging
import os
from django.conf import settings
from google.cloud import tasks_v2
from studio.jobs.artifact_jobs import generate_artifact_job

logger = logging.getLogger(__name__)

class ArtifactRunner:
    def dispatch(self, artifact_id, options):
        raise NotImplementedError

class ThreadingRunner(ArtifactRunner):
    """
    Executes the job in a separate thread within the same process.
    Suitable for local development (WSL).
    """
    def dispatch(self, artifact_id, options):
        logger.info(f"[ThreadingRunner] Dispatching artifact {artifact_id}")
        t = threading.Thread(
            target=generate_artifact_job,
            args=(artifact_id, options)
        )
        t.daemon = True
        t.start()
        return f"thread-{t.ident or 'pending'}"

class CloudTasksRunner(ArtifactRunner):
    """
    Dispatches the job to Google Cloud Tasks.
    Suitable for Production.
    """
    def dispatch(self, artifact_id, options):
        project = settings.GCP_PROJECT
        location = settings.GCP_LOCATION
        queue = settings.GCP_QUEUE

        if not all([project, location, queue]):
            logger.error("Missing GCP Cloud Tasks configuration (GCP_PROJECT, GCP_LOCATION, GCP_QUEUE).")
            return

        try:
            client = tasks_v2.CloudTasksClient()
            parent = client.queue_path(project, location, queue)

            # Internal webhook URL that the worker will listen to
            url = "/api/v1/studio/internal/tasks/generate_artifact/"

            payload = {
                'artifact_id': artifact_id,
                'options': options
            }

            # Check if we need a full URL (e.g. for Cloud Run)
            base_url = getattr(settings, 'GCP_SERVICE_URL', '')
            if base_url:
                url = f"{base_url.rstrip('/')}{url}"
            elif not url.startswith('http'):
                # If using relative URL without base_url, we rely on App Engine task queue behavior.
                # But if this is running on Cloud Run or similar, it will fail.
                logger.warning("[CloudTasksRunner] No GCP_SERVICE_URL set. Using relative URL which requires App Engine Queue configuration.")

            task = {
                'http_request': {
                    'http_method': tasks_v2.HttpMethod.POST,
                    'url': url,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps(payload).encode()
                }
            }

            # Add Secret Header for Security
            secret = os.getenv('CLOUD_TASKS_SECRET')
            if secret:
                task['http_request']['headers']['X-CloudTasks-Secret'] = secret

            response = client.create_task(request={"parent": parent, "task": task})
            logger.info(f"[CloudTasksRunner] Dispatched artifact {artifact_id} to {response.name}")
            return response.name
        except Exception as e:
            logger.error(f"[CloudTasksRunner] Failed to dispatch task: {e}", exc_info=True)
            # Re-raise so the caller can handle the error (set status to ERROR)
            raise e

def get_runner(backend_name=None):
    if backend_name is None:
        backend_name = getattr(settings, 'QUEUE_BACKEND', 'thread')

    if backend_name == 'cloud_tasks':
        return CloudTasksRunner()

    # Default to Threading
    return ThreadingRunner()
