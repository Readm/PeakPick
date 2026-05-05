"""Thumbnail cache manager for PeakPick ML backend.

Caches generated thumbnails as JPEG files in ~/.peakpick/thumbnails/.
"""

import base64
import hashlib
import logging
import os
from pathlib import Path
from typing import Optional

from PIL import Image

logger = logging.getLogger(__name__)

THUMBNAIL_DIR = Path.home() / ".peakpick" / "thumbnails"


def _ensure_dir() -> Path:
    """Ensure the thumbnail directory exists and return its path."""
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    return THUMBNAIL_DIR


def _thumbnail_cache_path(filepath: str, size: int) -> Path:
    """Return the cache path for a given filepath and size.

    Uses MD5 of the absolute path as the cache key.
    """
    abs_path = str(Path(filepath).resolve())
    key = hashlib.md5(abs_path.encode("utf-8")).hexdigest()
    return _ensure_dir() / f"{key}_{size}.jpg"


def get_thumbnail(filepath: str, size: int = 400) -> Optional[str]:
    """Get a base64 JPEG thumbnail for an image.

    Returns cached version if available, otherwise generates and caches it.

    Args:
        filepath: Path to the image file.
        size: Maximum width/height of the thumbnail (default: 400).

    Returns:
        Base64-encoded JPEG string, or None if generation fails.
    """
    cache_path = _thumbnail_cache_path(filepath, size)

    # Return cached thumbnail if it exists and source is newer
    if cache_path.exists():
        source_path = Path(filepath)
        if source_path.exists() and source_path.stat().st_mtime <= cache_path.stat().st_mtime:
            try:
                with open(cache_path, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception as e:
                logger.warning("Could not read cached thumbnail %s: %s", cache_path, e)

    # Generate thumbnail
    try:
        with Image.open(filepath) as img:
            # Calculate new size maintaining aspect ratio
            w, h = img.size
            if w > size or h > size:
                if w > h:
                    new_w = size
                    new_h = int(h * (size / w))
                else:
                    new_h = size
                    new_w = int(w * (size / h))
                img = img.resize((new_w, new_h), Image.LANCZOS)

            # Convert to RGB
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")

            # Save to cache as JPEG
            img.save(cache_path, format="JPEG", quality=85)

            # Return base64
            with open(cache_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        logger.warning("Could not generate thumbnail for %s: %s", filepath, e)
        return None


def clear_cache() -> int:
    """Remove all cached thumbnails.

    Returns:
        Number of files removed.
    """
    if not THUMBNAIL_DIR.exists():
        return 0

    count = 0
    for f in THUMBNAIL_DIR.iterdir():
        if f.is_file() and f.suffix == ".jpg":
            try:
                f.unlink()
                count += 1
            except OSError as e:
                logger.warning("Could not remove cached thumbnail %s: %s", f, e)

    logger.info("Cleared %d cached thumbnails", count)
    return count
