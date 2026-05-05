"""File scanning logic for PeakPick ML backend.

Handles recursive directory scanning, metadata extraction, and thumbnail generation.
"""

import base64
import io
import logging
import os
from pathlib import Path
from typing import Optional

from PIL import Image

logger = logging.getLogger(__name__)

# Supported image file extensions
IMAGE_EXTENSIONS: set[str] = {
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".nef",
    ".cr2",
    ".arw",
    ".tiff",
    ".tif",
    ".dng",
    ".orf",
    ".rw2",
}


def scan_directory(path: str) -> list[dict[str, str]]:
    """Recursively scan a directory for image files.

    Args:
        path: Directory path to scan.

    Returns:
        List of dicts with 'filename' and 'filepath' keys for each image found.

    Raises:
        FileNotFoundError: If the path does not exist.
        NotADirectoryError: If the path is not a directory.
    """
    dir_path = Path(path).expanduser().resolve()

    if not dir_path.exists():
        raise FileNotFoundError(f"Directory not found: {path}")
    if not dir_path.is_dir():
        raise NotADirectoryError(f"Not a directory: {path}")

    files: list[dict[str, str]] = []

    for entry in sorted(dir_path.rglob("*")):
        # Skip hidden files and directories
        if any(part.startswith(".") for part in entry.parts):
            continue
        if not entry.is_file():
            continue

        ext = entry.suffix.lower()
        if ext in IMAGE_EXTENSIONS:
            files.append(
                {
                    "filename": entry.name,
                    "filepath": str(entry),
                }
            )

    logger.info("Scanned %s: found %d image files", path, len(files))
    return files


def extract_metadata(filepath: str) -> dict:
    """Extract metadata from an image file.

    Args:
        filepath: Path to the image file.

    Returns:
        Dict with date_taken, width, height, file_size keys.
        date_taken may be None if EXIF data is unavailable.
    """
    result: dict = {
        "date_taken": None,
        "width": None,
        "height": None,
        "file_size": None,
    }

    try:
        stat_info = os.stat(filepath)
        result["file_size"] = stat_info.st_size
    except OSError as e:
        logger.warning("Could not stat %s: %s", filepath, e)

    try:
        with Image.open(filepath) as img:
            result["width"] = img.width
            result["height"] = img.height

            # Try to extract EXIF date
            exif = img.getexif()
            # EXIF tag 36867 = DateTimeOriginal, 36868 = DateTimeDigitized, 306 = DateTime
            date_tag = exif.get(36867) or exif.get(36868) or exif.get(306)
            if date_tag:
                # Format: "YYYY:MM:DD HH:MM:SS" -> normalize to YYYY-MM-DD
                date_str = str(date_tag).strip()
                if ":" in date_str[:5]:
                    date_str = date_str.replace(":", "-", 2)
                result["date_taken"] = date_str
    except Exception as e:
        logger.warning("Could not read metadata from %s: %s", filepath, e)

    return result


def generate_thumbnail(filepath: str, max_width: int = 400) -> Optional[str]:
    """Generate a base64 JPEG thumbnail for an image.

    Args:
        filepath: Path to the image file.
        max_width: Maximum width of the thumbnail (default: 400).

    Returns:
        Base64-encoded JPEG string, or None if generation fails.
    """
    try:
        with Image.open(filepath) as img:
            # Calculate new size maintaining aspect ratio
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.LANCZOS)
            else:
                # Image is already smaller, keep as is but still encode
                pass

            # Convert to RGB if necessary (e.g., RGBA, P mode)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            buf.seek(0)
            return base64.b64encode(buf.read()).decode("utf-8")
    except Exception as e:
        logger.warning("Could not generate thumbnail for %s: %s", filepath, e)
        return None
