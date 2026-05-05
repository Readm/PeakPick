"""Heuristic aesthetic scoring for PeakPick ML backend.

No torch needed — uses PIL and numpy for image analysis.
Provides a reasonable baseline score (1.0–5.0) based on:
  - Exposure (average brightness): 30% weight
  - Contrast (std of pixel values): 20% weight
  - Sharpness (Laplacian variance): 25% weight
  - Colorfulness (color channel variance): 25% weight
"""

import logging
from pathlib import Path

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def _normalize(value: float, lo: float, hi: float, target_lo: float = 1.0, target_hi: float = 5.0) -> float:
    """Clamp and linearly map a value from [lo, hi] to [target_lo, target_hi]."""
    clipped = max(lo, min(hi, value))
    if hi == lo:
        return (target_lo + target_hi) / 2.0
    ratio = (clipped - lo) / (hi - lo)
    return target_lo + ratio * (target_hi - target_lo)


def _score_exposure(img_array: np.ndarray) -> float:
    """Score exposure based on average brightness (normalized 0–255).

    Ideal exposure is around 128 (mid-gray).
    Range mapping: 0→1, 64→2, 128→5, 192→2, 255→1
    Uses a piecewise linear function.
    """
    # Convert to grayscale if needed
    if img_array.ndim == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array

    avg_brightness = float(np.mean(gray))

    # Piecewise: peak at ~128
    if avg_brightness <= 128:
        # 0→1, 64→3, 128→5
        score = 1.0 + (avg_brightness / 128.0) * 4.0
    else:
        # 128→5, 192→2.5, 255→1
        score = 5.0 - ((avg_brightness - 128.0) / 127.0) * 4.0

    return max(1.0, min(5.0, score))


def _score_contrast(img_array: np.ndarray) -> float:
    """Score contrast based on standard deviation of pixel values.

    Standard deviation range mapping (empirical):
    0→1 (no contrast), ~30→3 (moderate), ~70→5 (high contrast)
    """
    if img_array.ndim == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array

    std_val = float(np.std(gray))
    return _normalize(std_val, 0, 80, 1.0, 5.0)


def _score_sharpness(img_array: np.ndarray) -> float:
    """Score sharpness using Laplacian variance.

    Higher variance = sharper image.
    Range mapping (empirical for 8-bit images):
    0→1 (blurry), ~100→2, ~500→3, ~2000→4, ~5000+→5 (very sharp)
    """
    if img_array.ndim == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array

    gray = gray.astype(np.float32)

    # Apply 3x3 Laplacian kernel
    laplacian_kernel = np.array([[0, -1, 0], [-1, 4, -1], [0, -1, 0]], dtype=np.float32)

    # Convolve manually
    h, w = gray.shape
    if h < 3 or w < 3:
        return 2.5  # Too small to assess

    padded = np.pad(gray, ((1, 1), (1, 1)), mode="reflect")
    laplacian = np.zeros_like(gray)

    for i in range(h):
        for j in range(w):
            laplacian[i, j] = np.sum(laplacian_kernel * padded[i : i + 3, j : j + 3])

    variance = float(np.var(laplacian))
    return _normalize(variance, 0, 3000, 1.0, 5.0)


def _score_colorfulness(img_array: np.ndarray) -> float:
    """Score colorfulness based on color channel variance.

    Uses the Hasler & Süsstrunk colorfulness metric approximation.
    Higher values = more colorful.
    Range mapping: 0→1 (grayscale), ~20→2, ~60→3, ~120→4, ~200+→5
    """
    if img_array.ndim != 3 or img_array.shape[2] < 3:
        return 1.0  # Grayscale images

    # Extract RGB channels
    r = img_array[:, :, 0].astype(np.float32)
    g = img_array[:, :, 1].astype(np.float32)
    b = img_array[:, :, 2].astype(np.float32)

    # Colorfulness metric: sqrt(var(rg) + var(yb)) + 0.3 * sqrt(mean(rg)^2 + mean(yb)^2)
    rg = r - g
    yb = 0.5 * (r + g) - b

    std_rg = float(np.std(rg))
    std_yb = float(np.std(yb))
    mean_rg = float(np.mean(rg))
    mean_yb = float(np.mean(yb))

    colorfulness = np.sqrt(std_rg**2 + std_yb**2) + 0.3 * np.sqrt(mean_rg**2 + mean_yb**2)

    return _normalize(colorfulness, 0, 150, 1.0, 5.0)


def score_image(filepath: str) -> float:
    """Score an image based on heuristic aesthetic metrics.

    Args:
        filepath: Path to the image file.

    Returns:
        Float score between 1.0 (worst) and 5.0 (best).
    """
    try:
        with Image.open(filepath) as img:
            # Convert to RGB for consistent analysis
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img_array = np.array(img, dtype=np.float32)
    except Exception as e:
        logger.warning("Could not open %s for scoring: %s", filepath, e)
        return 3.0  # Default middle score on error

    # Handle very small images
    if img_array.shape[0] < 10 or img_array.shape[1] < 10:
        logger.debug("Image too small for scoring: %s", filepath)
        return 2.5

    exposure = _score_exposure(img_array)
    contrast = _score_contrast(img_array)
    sharpness = _score_sharpness(img_array)
    colorfulness = _score_colorfulness(img_array)

    # Weighted combination
    final_score = (
        exposure * 0.30 + contrast * 0.20 + sharpness * 0.25 + colorfulness * 0.25
    )

    # Clamp to [1.0, 5.0]
    final_score = max(1.0, min(5.0, final_score))

    logger.debug(
        "Scored %s: exposure=%.2f contrast=%.2f sharpness=%.2f color=%.2f -> total=%.2f",
        Path(filepath).name,
        exposure,
        contrast,
        sharpness,
        colorfulness,
        final_score,
    )

    return round(final_score, 2)
