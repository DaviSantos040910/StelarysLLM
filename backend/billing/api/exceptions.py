from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

class QuotaExceededException(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = 'Limite atingido para este recurso.'
    default_code = 'quota_exceeded'

    def __init__(self, detail=None, code=None, meta=None):
        self.meta = meta or {}
        if code:
            self.default_code = code
        super().__init__(detail, code)

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # Report non-quota exceptions to Sentry
    if not isinstance(exc, QuotaExceededException):
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except ImportError:
            pass

    # If it's our QuotaExceededException, format it strictly
    if isinstance(exc, QuotaExceededException):
        if response is None:
            # Should happen if exception_handler returns None for some reason
            from rest_framework.response import Response
            response = Response({}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        response.data = {
            "error": True,
            "code": exc.default_code,
            "message": str(exc.detail),
            "meta": exc.meta
        }

    return response

