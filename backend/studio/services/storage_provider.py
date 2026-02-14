import os
import shutil
import logging
from abc import ABC, abstractmethod
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

class StorageProvider(ABC):
    @abstractmethod
    def save_file(self, local_path, dest_path, content_type=None):
        pass

    @abstractmethod
    def save_bytes(self, data, dest_path, content_type=None):
        pass

    @abstractmethod
    def get_download_url(self, path_or_gs, expires_seconds=3600):
        pass

class LocalStorageProvider(StorageProvider):
    """
    Implements file storage using Django's default storage (FileSystemStorage).
    Suitable for development or when using Persistent Disk.
    """
    def save_file(self, local_path, dest_path, content_type=None):
        """
        Saves a local file to the destination path.
        """
        dest_path = dest_path.lstrip('/')

        # Check if local_path exists
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        # Ensure directory exists if using FileSystemStorage
        full_dest_path = os.path.join(settings.MEDIA_ROOT, dest_path)
        os.makedirs(os.path.dirname(full_dest_path), exist_ok=True)

        # Check if source and dest are the same file
        if os.path.abspath(local_path) != os.path.abspath(full_dest_path):
            shutil.copy2(local_path, full_dest_path)

        return self.get_download_url(dest_path)

    def save_bytes(self, data, dest_path, content_type=None):
        """
        Saves raw bytes to the destination path.
        """
        dest_path = dest_path.lstrip('/')
        path = default_storage.save(dest_path, ContentFile(data))
        return self.get_download_url(path)

    def get_download_url(self, path_or_gs, expires_seconds=3600):
        """
        Returns the MEDIA_URL for the given path.
        """
        # If it's a full URL or gs://, strip it or handle it
        if path_or_gs.startswith('http'):
            return path_or_gs

        path = path_or_gs.lstrip('/')
        if path.startswith('media/'):
            path = path[6:]

        return f"{settings.MEDIA_URL.rstrip('/')}/{path}"

class GCSStorageProvider(StorageProvider):
    """
    Placeholder for Google Cloud Storage implementation.
    """
    def save_file(self, local_path, dest_path, content_type=None):
        raise NotImplementedError("GCS Storage not yet implemented")

    def save_bytes(self, data, dest_path, content_type=None):
        raise NotImplementedError("GCS Storage not yet implemented")

    def get_download_url(self, path_or_gs, expires_seconds=3600):
        raise NotImplementedError("GCS Storage not yet implemented")

def get_storage_provider(backend_name=None):
    if backend_name is None:
        backend_name = os.getenv('STORAGE_BACKEND', 'local')

    if backend_name == 'gcs':
        return GCSStorageProvider()

    return LocalStorageProvider()
