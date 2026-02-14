import logging
from django.conf import settings
from studio.runners import get_runner

logger = logging.getLogger(__name__)

def enqueue_artifact(artifact_id: int, options: dict, ctx: dict = None) -> str:
    """
    Public function to enqueue artifact generation.
    Supports switching between Threading (dev) and Cloud Tasks (prod) via env QUEUE_BACKEND.

    Args:
        artifact_id: ID of the KnowledgeArtifact to process.
        options: Configuration options for generation.
        ctx: Optional context dictionary (e.g. user info, tracing).

    Returns:
        str: Task ID or None if dispatched fire-and-forget.
    """
    backend_name = getattr(settings, 'QUEUE_BACKEND', 'thread')

    # Use the existing runner infrastructure
    runner = get_runner(backend_name)

    # We could extend runner.dispatch to accept ctx if needed later
    # Runners should return a Task ID or similar identifier
    return runner.dispatch(artifact_id, options)
