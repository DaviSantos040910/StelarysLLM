import os
import shutil
import logging
import datetime
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
        dest_path = dest_path.replace("\\", "/").lstrip("/")

        t_start = datetime.datetime.now()
        logger.info(f"storage.save_file.start local={local_path} dest={dest_path} type={content_type}")

        # Check if local_path exists
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        # Ensure directory exists if using FileSystemStorage
        full_dest_path = os.path.join(settings.MEDIA_ROOT, dest_path)
        os.makedirs(os.path.dirname(full_dest_path), exist_ok=True)

        # Check if source and dest are the same file
        if os.path.abspath(local_path) != os.path.abspath(full_dest_path):
            shutil.copy2(local_path, full_dest_path)

        elapsed = (datetime.datetime.now() - t_start).total_seconds() * 1000
        logger.info(f"storage.save_file.end dest={dest_path} elapsed_ms={elapsed:.2f}")
        return self.get_download_url(dest_path)

    def save_bytes(self, data, dest_path, content_type=None):
        """
        Saves raw bytes to the destination path.
        """
        dest_path = dest_path.replace("\\", "/").lstrip("/")
        t_start = datetime.datetime.now()
        logger.info(f"storage.save_bytes.start dest={dest_path} len={len(data)} type={content_type}")

        path = default_storage.save(dest_path, ContentFile(data))

        elapsed = (datetime.datetime.now() - t_start).total_seconds() * 1000
        logger.info(f"storage.save_bytes.end dest={dest_path} elapsed_ms={elapsed:.2f}")
        return self.get_download_url(path)

    def get_download_url(self, path_or_gs, expires_seconds=3600):
        """
        Returns the MEDIA_URL for the given path.
        """
        if not path_or_gs:
            return None

        # If it's a full URL or gs://, strip it or handle it
        if path_or_gs.startswith('http'):
            return path_or_gs

        path = path_or_gs.lstrip('/')
        if path.startswith('media/'):
            path = path[6:]

        return f"{settings.MEDIA_URL.rstrip('/')}/{path}"

class GCSStorageProvider(StorageProvider):
    """
    Implements Google Cloud Storage backend.
    Requires google-cloud-storage library and GCS_BUCKET_NAME setting.
    """
    def __init__(self):
        from google.cloud import storage
        self.bucket_name = settings.GCS_BUCKET_NAME
        if not self.bucket_name:
            raise ValueError("GCS_BUCKET_NAME setting is required for GCSStorageProvider")

        # Assuming Application Default Credentials are set in the environment
        self.client = storage.Client()
        self.bucket = self.client.bucket(self.bucket_name)

    def save_file(self, local_path, dest_path, content_type=None):
        dest_path = dest_path.replace("\\", "/").lstrip("/")
        t_start = datetime.datetime.now()
        logger.info(f"storage.save_file.start local={local_path} dest={dest_path} type={content_type}")

        try:
            blob = self.bucket.blob(dest_path)
            if content_type:
                blob.content_type = content_type

            blob.upload_from_filename(local_path)

            elapsed = (datetime.datetime.now() - t_start).total_seconds() * 1000
            logger.info(f"storage.save_file.end dest={dest_path} elapsed_ms={elapsed:.2f}")
            return f"gs://{self.bucket_name}/{dest_path}"
        except Exception as e:
            logger.error(f"storage.error: {e}", exc_info=True)
            raise e

    def save_bytes(self, data, dest_path, content_type=None):
        dest_path = dest_path.replace("\\", "/").lstrip("/")
        t_start = datetime.datetime.now()
        logger.info(f"storage.save_bytes.start dest={dest_path} len={len(data)} type={content_type}")

        try:
            blob = self.bucket.blob(dest_path)
            if content_type:
                blob.content_type = content_type

            blob.upload_from_string(data)

            elapsed = (datetime.datetime.now() - t_start).total_seconds() * 1000
            logger.info(f"storage.save_bytes.end dest={dest_path} elapsed_ms={elapsed:.2f}")
            return f"gs://{self.bucket_name}/{dest_path}"
        except Exception as e:
            logger.error(f"storage.error: {e}", exc_info=True)
            raise e

    def get_download_url(self, path_or_gs, expires_seconds=3600):
        if not path_or_gs:
            return None

        # If it's already http, return as is
        if path_or_gs.startswith('http'):
            return path_or_gs

        # Parse gs:// uri
        blob_path = path_or_gs
        if path_or_gs.startswith("gs://"):
            parts = path_or_gs.replace("gs://", "").split("/", 1)
            if len(parts) == 2:
                # bucket = parts[0] # We assume configured bucket usually, but gs uri has it
                blob_path = parts[1]
            else:
                return path_or_gs # Invalid format?

        # Generate Signed URL
        blob = self.bucket.blob(blob_path)
        try:
            url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(seconds=expires_seconds),
                method="GET"
            )
            return url
        except Exception as e:
            logger.error(f"Error generating signed URL for {blob_path}: {e}")
            return None

def get_storage_provider(backend_name=None):
    if backend_name is None:
        backend_name = os.getenv('STORAGE_BACKEND', 'local')

    if backend_name == 'gcs':
        return GCSStorageProvider()

    return LocalStorageProvider()
