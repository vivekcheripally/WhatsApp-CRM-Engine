import os
from typing import Optional
from core.config import settings


class BaseStorageProvider:
    def save_file(self, file_bytes: bytes, filename: str, mime_type: str = "application/octet-stream") -> str:
        raise NotImplementedError

    def get_file_bytes(self, file_path_or_url: str) -> Optional[bytes]:
        raise NotImplementedError


class LocalStorageProvider(BaseStorageProvider):
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def save_file(self, file_bytes: bytes, filename: str, mime_type: str = "application/octet-stream") -> str:
        dest = os.path.join(self.upload_dir, filename)
        with open(dest, "wb") as f:
            f.write(file_bytes)
        return f"/uploads/{filename}"

    def get_file_bytes(self, file_path_or_url: str) -> Optional[bytes]:
        if not file_path_or_url:
            return None
        cleaned = file_path_or_url.lstrip("/\\")
        rel_path = os.path.normpath(cleaned)
        abs_path = os.path.abspath(rel_path)
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "rb") as f:
                    return f.read()
            except Exception as e:
                print(f"[LocalStorageProvider] Read error: {e}")
        return None


class S3StorageProvider(BaseStorageProvider):
    def __init__(self):
        import boto3
        self.bucket = settings.S3_BUCKET_NAME or settings.AWS_BUCKET_NAME
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )

    def save_file(self, file_bytes: bytes, filename: str, mime_type: str = "application/octet-stream") -> str:
        key = f"uploads/{filename}"
        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_bytes,
            ContentType=mime_type,
        )
        if settings.S3_CUSTOM_DOMAIN:
            return f"{settings.S3_CUSTOM_DOMAIN.rstrip('/')}/{key}"
        return f"https://{self.bucket}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"

    def get_file_bytes(self, file_path_or_url: str) -> Optional[bytes]:
        if not file_path_or_url:
            return None
        try:
            if "amazonaws.com/" in file_path_or_url:
                key = file_path_or_url.split("amazonaws.com/")[-1].lstrip("/")
            elif settings.S3_CUSTOM_DOMAIN and settings.S3_CUSTOM_DOMAIN in file_path_or_url:
                key = file_path_or_url.split(settings.S3_CUSTOM_DOMAIN)[-1].lstrip("/")
            else:
                key = file_path_or_url.lstrip("/\\")
            response = self.s3_client.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()
        except Exception as e:
            print(f"[S3StorageProvider] S3 Read error: {e}")
            return None


def get_storage_provider() -> BaseStorageProvider:
    if getattr(settings, "STORAGE_PROVIDER", "local").lower() == "s3" and (settings.S3_BUCKET_NAME or settings.AWS_BUCKET_NAME):
        try:
            return S3StorageProvider()
        except Exception as ex:
            print(f"[StorageService Warning] Could not initialize S3 provider ({ex}). Falling back to LocalStorageProvider.")
    return LocalStorageProvider()
