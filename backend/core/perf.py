import time
import logging

logger = logging.getLogger("performance")

def now_ms():
    return time.perf_counter() * 1000

def ms_since(t0):
    return int((time.perf_counter() * 1000) - t0)

def log_perf(event_name, artifact_id, job_id=None, elapsed_ms=None, **kwargs):
    extra = {
        'event': event_name,
        'artifact_id': artifact_id,
        'job_id': job_id or 'N/A',
        **kwargs
    }
    if elapsed_ms is not None:
        extra['elapsed_ms'] = elapsed_ms

    # Format log message
    kv_str = " ".join([f"{k}={v}" for k, v in extra.items()])
    logger.info(f"[PERF] {kv_str}")
