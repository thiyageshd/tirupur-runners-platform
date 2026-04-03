import base64
from pathlib import Path

from app.core.config import settings

_MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


def _uploads_root() -> Path:
    if settings.UPLOADS_DIR:
        return Path(settings.UPLOADS_DIR)
    # Default: <backend_dir>/uploads  (three levels up from app/core/uploads.py)
    return Path(__file__).parent.parent.parent / "uploads"


def _save_data_uri(subdir: str, filename_stem: str, data_uri: str) -> tuple[str, str]:
    """Decode a base64 data URI, write to disk, return (url, filename)."""
    header, encoded = data_uri.split(",", 1)
    mime = header.split(":")[1].split(";")[0]
    ext = _MIME_TO_EXT.get(mime, "bin")
    dest_dir = _uploads_root() / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{filename_stem}.{ext}"
    (dest_dir / filename).write_bytes(base64.b64decode(encoded))
    url = f"{settings.MEDIA_BASE_URL}/uploads/{subdir}/{filename}"
    return url, filename


def save_aadhar_file(user_id: str, data_uri: str) -> str:
    """Save Aadhar to uploads/aadhar/ and return the accessible URL."""
    url, _ = _save_data_uri("aadhar", user_id, data_uri)
    return url


def save_photo_file(user_id: str, data_uri: str) -> str:
    """Save profile photo to uploads/photos/ and return the accessible URL."""
    url, _ = _save_data_uri("photos", user_id, data_uri)
    return url


def save_receipt_file(payment_id: str, year: int, html: str) -> str:
    """Save receipt HTML to uploads/receipts/{year}/ and return the accessible URL."""
    receipts_dir = _uploads_root() / "receipts" / str(year)
    receipts_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{payment_id}.html"
    (receipts_dir / filename).write_text(html, encoding="utf-8")
    return f"{settings.MEDIA_BASE_URL}/uploads/receipts/{year}/{filename}"
