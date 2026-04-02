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


def save_aadhar_file(user_id: str, data_uri: str) -> str:
    """
    Decode a base64 data URI, write to disk, and return the accessible URL.
    File is named {user_id}.{ext} — re-uploading replaces the previous file.
    """
    header, encoded = data_uri.split(",", 1)
    mime = header.split(":")[1].split(";")[0]
    ext = _MIME_TO_EXT.get(mime, "bin")

    aadhar_dir = _uploads_root() / "aadhar"
    aadhar_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{user_id}.{ext}"
    (aadhar_dir / filename).write_bytes(base64.b64decode(encoded))

    return f"{settings.MEDIA_BASE_URL}/uploads/aadhar/{filename}"
