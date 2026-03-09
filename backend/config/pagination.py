# config/pagination.py
from rest_framework.pagination import PageNumberPagination

class StandardMessagePagination(PageNumberPagination):
    """
    Custom pagination class for chat messages.
    Loads 30 messages per page and allows the client to specify the page size.
    """
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 100