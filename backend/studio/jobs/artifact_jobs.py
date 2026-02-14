import logging
from django_rq import job
from rq import Retry, get_current_job
from studio.services.artifact_runner import generate_artifact

logger = logging.getLogger(__name__)

@job('default', timeout=360, result_ttl=86400, retry=Retry(max=3))
def generate_artifact_job(artifact_id, options):
    """
    Legacy entrypoint for RQ.
    Now delegates everything to artifact_runner.generate_artifact.
    """
    job = get_current_job()
    job_id = job.id if job else 'unknown'

    # Delegate to the centralized runner
    # We pass job_id as job_ref for tracing
    generate_artifact(artifact_id, options, job_ref=job_id)
