from rest_framework import status
from rest_framework.exceptions import APIException

class DocumentInvalidException(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = 'document_invalid_scanned'

    def __init__(self, detail=None, code=None, meta=None):
        """
        :param detail: The error message.
        :param code: The error code (default: 'document_invalid_scanned').
        :param meta: Optional dictionary with additional info (e.g. source_id).
        """
        self.meta = meta or {}
        if code:
            self.default_code = code
        super().__init__(detail, code)
