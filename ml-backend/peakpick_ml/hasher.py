"""Perceptual hashing for PeakPick similar photo detection.

Provides pHash (perceptual hash) and dHash (difference hash) algorithms
for detecting near-duplicate and similar images.
"""

import logging
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def _ensure_grayscale(img_array: np.ndarray) -> np.ndarray:
    """Convert RGB array to grayscale if needed."""
    if img_array.ndim == 3:
        return np.mean(img_array, axis=2).astype(np.float32)
    return img_array.astype(np.float32)


def dhash(filepath: str, hash_size: int = 8) -> Optional[int]:
    """Compute a difference hash (dHash) for an image.

    dHash is faster than pHash and works well for near-duplicate detection.
    It compares adjacent pixels horizontally to generate a bitstring.

    Args:
        filepath: Path to the image file.
        hash_size: Size of the hash (produces hash_size * hash_size bits).

    Returns:
        Integer hash value, or None if the image can't be processed.
    """
    try:
        with Image.open(filepath) as img:
            # Convert to grayscale and resize to (hash_size+1) x hash_size
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img = img.resize((hash_size + 1, hash_size), Image.LANCZOS)
            gray = img.convert("L")
            pixels = np.array(gray, dtype=np.float32)

        # Compare adjacent pixels: left > right → 1, else 0
        diff = pixels[:, :-1] > pixels[:, 1:]
        hash_int = 0
        for i in range(hash_size):
            for j in range(hash_size):
                if diff[i, j]:
                    hash_int |= 1 << (i * hash_size + j)
        return hash_int
    except Exception as e:
        logger.warning("dHash failed for %s: %s", filepath, e)
        return None


def phash(filepath: str, hash_size: int = 8) -> Optional[int]:
    """Compute a perceptual hash (pHash) for an image.

    Uses DCT (Discrete Cosine Transform) to extract low-frequency features.
    More robust than dHash for images with different exposures or edits.

    Args:
        filepath: Path to the image file.
        hash_size: Size of the hash (produces hash_size * hash_size bits).

    Returns:
        Integer hash value, or None if the image can't be processed.
    """
    try:
        with Image.open(filepath) as img:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            # Resize to hash_size*4 for better DCT resolution, then to hash_size
            img = img.resize((hash_size * 4, hash_size * 4), Image.LANCZOS)
            gray = img.convert("L")
            pixels = np.array(gray, dtype=np.float32)

        # Apply DCT (simple 2D DCT)
        dct = _dct_2d(pixels)

        # Take top-left hash_size x hash_size block (lowest frequencies)
        dct_low = dct[:hash_size, :hash_size]

        # Compute median and generate hash
        median = np.median(dct_low)
        hash_int = 0
        for i in range(hash_size):
            for j in range(hash_size):
                if dct_low[i, j] > median:
                    hash_int |= 1 << (i * hash_size + j)
        return hash_int
    except Exception as e:
        logger.warning("pHash failed for %s: %s", filepath, e)
        return None


def _dct_2d(matrix: np.ndarray) -> np.ndarray:
    """Compute 2D Discrete Cosine Transform (Type II)."""
    n = matrix.shape[0]
    result = np.zeros_like(matrix, dtype=np.float64)
    factor = np.pi / n

    for u in range(n):
        cu = 1.0 / np.sqrt(2) if u == 0 else 1.0
        for v in range(n):
            cv = 1.0 / np.sqrt(2) if v == 0 else 1.0
            sum_val = 0.0
            for x in range(n):
                for y in range(n):
                    sum_val += matrix[x, y] * np.cos((2 * x + 1) * u * factor / 2) * np.cos((2 * y + 1) * v * factor / 2)
            result[u, v] = 0.25 * cu * cv * sum_val
    return result


def hamming_distance(hash1: int, hash2: int, bits: int = 64) -> int:
    """Compute the Hamming distance between two hashes.

    Args:
        hash1: First hash integer.
        hash2: Second hash integer.
        bits: Number of bits in the hash (default: 64 for 8x8).

    Returns:
        Hamming distance (number of differing bits).
    """
    xor = hash1 ^ hash2
    distance = 0
    for _ in range(bits):
        if xor & 1:
            distance += 1
        xor >>= 1
    return distance


def compute_phash(filepath: str) -> Optional[tuple[int, int]]:
    """Compute both dHash and pHash for an image.

    Returns:
        Tuple of (dhash, phash) integers, or None on failure.
    """
    dh = dhash(filepath)
    ph = phash(filepath)
    if dh is None or ph is None:
        return None
    return (dh, ph)


def find_similar_groups(
    hashes: dict[str, tuple[int, int]],
    threshold: int = 10,
) -> list[list[str]]:
    """Group images by similarity based on hash distances.

    Two images are considered similar if both their dHash and pHash
    Hamming distances are below the threshold.

    Args:
        hashes: Dict mapping filepath to (dhash, phash) tuple.
        threshold: Maximum Hamming distance for similarity (default: 10).

    Returns:
        List of groups, where each group is a list of filepaths.
    """
    filepaths = list(hashes.keys())
    groups: list[list[str]] = []
    assigned: set[str] = set()

    for i, fp1 in enumerate(filepaths):
        if fp1 in assigned:
            continue
        group = [fp1]
        h1_d, h1_p = hashes[fp1]
        for j in range(i + 1, len(filepaths)):
            fp2 = filepaths[j]
            if fp2 in assigned:
                continue
            h2_d, h2_p = hashes[fp2]
            d_dist = hamming_distance(h1_d, h2_d)
            p_dist = hamming_distance(h1_p, h2_p)
            if d_dist <= threshold and p_dist <= threshold:
                group.append(fp2)
                assigned.add(fp2)
        if len(group) > 1:
            assigned.add(fp1)
            groups.append(group)

    return groups
