import logging
import threading
import json
import os
from django.conf import settings
from google.cloud import tasks_v2
from chat.jobs.transcription_jobs import process_youtube_source_context_job

logger = logging.getLogger(__name__)

def enqueue_youtube_ingestion(source_id: int, bot_id: int = None, study_space_id: int = None) -> str:
    """
    Enqueues YouTube ingestion task using Thread (Dev) or Cloud Tasks (Prod).
    """
    backend_name = getattr(settings, 'QUEUE_BACKEND', 'thread')

    payload = {
        'source_id': source_id,
        'bot_id': bot_id,
        'study_space_id': study_space_id
    }

    if backend_name == 'thread':
        logger.info(f"[Threading] Dispatching YouTube ingestion for source {source_id}")
        t = threading.Thread(
            target=process_youtube_source_context_job,
            args=(source_id,),
            kwargs={'bot_id': bot_id, 'study_space_id': study_space_id}
        )
        t.daemon = True
        t.start()
        return "thread-dispatched"

    elif backend_name == 'cloud_tasks':
        return _dispatch_cloud_task(payload)

    return "unknown-backend"

def _dispatch_cloud_task(payload):
    project = settings.GCP_PROJECT
    location = settings.GCP_LOCATION
    queue = settings.GCP_QUEUE

    if not all([project, location, queue]):
        logger.error("Missing GCP Cloud Tasks configuration.")
        return None

    try:
        client = tasks_v2.CloudTasksClient()
        parent = client.queue_path(project, location, queue)

        # Ensure we use the ingestion specific endpoint
        url = "/api/v1/chats/internal/tasks/ingest_youtube/"

        base_url = getattr(settings, 'GCP_SERVICE_URL', '')
        if base_url:
            url = f"{base_url.rstrip('/')}{url}"

        task = {
            'http_request': {
                'http_method': tasks_v2.HttpMethod.POST,
                'url': url,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(payload).encode()
            }
        }

        secret = os.getenv('CLOUD_TASKS_SECRET')
        if secret:
            task['http_request']['headers']['X-CloudTasks-Secret'] = secret

        response = client.create_task(request={"parent": parent, "task": task})
        logger.info(f"[CloudTasks] Dispatched ingestion source {payload['source_id']} to {response.name}")
        return response.name
    except Exception as e:
        logger.error(f"[CloudTasks] Failed to dispatch ingestion: {e}", exc_info=True)
        return None
