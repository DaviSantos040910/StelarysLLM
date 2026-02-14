import json
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
from studio.jobs.artifact_jobs import generate_artifact_job
from studio.models import KnowledgeArtifact

logger = logging.getLogger(__name__)

class ArtifactGenerationTaskView(APIView):
    """
    Internal endpoint for Cloud Tasks to execute artifact generation.
    Receives a POST payload with artifact_id and options, and executes the job synchronously.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        # Security Check: Verify request comes from Cloud Tasks
        # In production (Cloud Run/App Engine), Google injects specific headers.
        # We strip these headers from external requests at the load balancer level usually,
        # but checking them here adds a layer of defense.

        is_cloud_task = (
            request.META.get('HTTP_X_CLOUDTASKS_QUEUENAME') or
            request.META.get('HTTP_X_APPENGINE_QUEUENAME')
        )

        if not is_cloud_task and not settings.DEBUG:
            # If not in DEBUG mode and missing Cloud Task headers, block.
            logger.warning(f"Unauthorized access to internal task endpoint from {request.META.get('REMOTE_ADDR')}")
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        try:
            artifact_id = request.data.get('artifact_id')
            options = request.data.get('options', {})

            if not artifact_id:
                return Response({"error": "Missing artifact_id"}, status=status.HTTP_400_BAD_REQUEST)

            # Idempotency Check
            try:
                artifact = KnowledgeArtifact.objects.get(id=artifact_id)
                # If already done or failed, don't re-run.
                if artifact.status in [KnowledgeArtifact.Status.READY, KnowledgeArtifact.Status.ERROR]:
                    logger.info(f"[TaskHandler] Artifact {artifact_id} already in status {artifact.status}. Skipping.")
                    return Response({"status": "skipped", "reason": f"already_{artifact.status}"}, status=status.HTTP_200_OK)
            except KnowledgeArtifact.DoesNotExist:
                logger.error(f"[TaskHandler] Artifact {artifact_id} not found.")
                return Response({"error": "Artifact not found"}, status=status.HTTP_404_NOT_FOUND)

            logger.info(f"[TaskHandler] Received task for artifact {artifact_id}")

            # Execute the job logic synchronously
            generate_artifact_job(artifact_id, options)

            return Response({"status": "executed"}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[TaskHandler] Error executing task for artifact {artifact_id}: {e}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
