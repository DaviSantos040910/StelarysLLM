import json
import logging
import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
from chat.jobs.transcription_jobs import process_youtube_source_context_job

logger = logging.getLogger(__name__)

class IngestionTaskView(APIView):
    """
    Internal endpoint for Cloud Tasks to execute YouTube ingestion.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        # 1. Security Check
        is_cloud_task = (
            request.META.get('HTTP_X_CLOUDTASKS_QUEUENAME') or
            request.META.get('HTTP_X_APPENGINE_QUEUENAME')
        )
        secret_header = request.META.get('HTTP_X_CLOUDTASKS_SECRET')
        env_secret = os.getenv('CLOUD_TASKS_SECRET')

        # H2: Fail closed — if no secret is configured in production, reject all requests
        if not env_secret and not settings.DEBUG:
            logger.warning("Unauthorized access: CLOUD_TASKS_SECRET not configured in production")
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        if env_secret and secret_header != env_secret:
             logger.warning(f"Unauthorized access: Invalid CloudTasks Secret")
             return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        if not is_cloud_task and not settings.DEBUG:
            logger.warning(f"Unauthorized access to internal ingestion task")
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        try:
            source_id = request.data.get('source_id')
            bot_id = request.data.get('bot_id')
            study_space_id = request.data.get('study_space_id')

            if not source_id:
                return Response({"error": "Missing source_id"}, status=status.HTTP_400_BAD_REQUEST)

            logger.info(f"[IngestionHandler] Processing YouTube source {source_id}")

            # Execute synchronously
            process_youtube_source_context_job(source_id, bot_id=bot_id, study_space_id=study_space_id)

            return Response({"status": "executed"}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[IngestionHandler] Error processing source {source_id}: {e}", exc_info=True)
            return Response({"error": "Internal processing error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
