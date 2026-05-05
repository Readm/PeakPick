"""Tests for the perceptual hasher module."""

from pathlib import Path

import pytest
from PIL import Image


@pytest.fixture
def identical_images(tmp_path: Path):
    """Create two identical test images."""
    p1 = tmp_path / "img1.jpg"
    p2 = tmp_path / "img2.jpg"
    img = Image.new("RGB", (200, 150), color=(100, 150, 200))
    img.save(str(p1), format="JPEG")
    img.save(str(p2), format="JPEG")
    return str(p1), str(p2)


@pytest.fixture
def different_images(tmp_path: Path):
    """Create two very different test images with content."""
    p1 = tmp_path / "landscape.jpg"
    p2 = tmp_path / "portrait.jpg"
    # A simple gradient landscape
    img1 = Image.new("RGB", (200, 150))
    for y in range(150):
        for x in range(200):
            img1.putpixel((x, y), (int(x * 0.8), int(y * 0.5), 100))
    img1.save(str(p1), format="JPEG")
    # A checkered pattern portrait
    img2 = Image.new("RGB", (200, 150))
    for y in range(150):
        for x in range(200):
            v = 255 if (x // 20 + y // 20) % 2 == 0 else 0
            img2.putpixel((x, y), (v, v, v))
    img2.save(str(p2), format="JPEG")
    return str(p1), str(p2)


@pytest.fixture
def slightly_different_images(tmp_path: Path):
    """Create images with very slight differences (like same photo, different brightness)."""
    p1 = tmp_path / "original.jpg"
    p2 = tmp_path / "edited.jpg"
    # Same 64x64 pattern for both
    def make_img(brightness_offset=0):
        img = Image.new("RGB", (64, 64))
        for y in range(64):
            for x in range(64):
                r = max(0, min(255, 128 + 64 * ((x + y) % 3 - 1) + brightness_offset))
                g = max(0, min(255, 100 + 80 * ((x - y) % 5 - 2) + brightness_offset))
                b = max(0, min(255, 180 + 40 * (x % 7 - 3) + brightness_offset))
                img.putpixel((x, y), (r, g, b))
        return img
    make_img(0).save(str(p1), format="JPEG")
    make_img(15).save(str(p2), format="JPEG")  # +15 brightness shift
    return str(p1), str(p2)


class TestDHash:
    def test_identical_images(self, identical_images):
        from peakpick_ml.hasher import dhash, hamming_distance

        p1, p2 = identical_images
        h1 = dhash(p1)
        h2 = dhash(p2)
        assert h1 is not None
        assert h2 is not None
        dist = hamming_distance(h1, h2)
        assert dist == 0, f"Identical images should have distance 0, got {dist}"

    def test_different_images(self, different_images):
        from peakpick_ml.hasher import dhash, hamming_distance

        p1, p2 = different_images
        h1 = dhash(p1)
        h2 = dhash(p2)
        assert h1 is not None
        assert h2 is not None
        dist = hamming_distance(h1, h2)
        assert dist > 10, f"Different images should have high distance, got {dist}"

    def test_nonexistent_file(self):
        from peakpick_ml.hasher import dhash

        h = dhash("/nonexistent/image.jpg")
        assert h is None


class TestPHash:
    def test_identical_images(self, identical_images):
        from peakpick_ml.hasher import phash, hamming_distance

        p1, p2 = identical_images
        h1 = phash(p1)
        h2 = phash(p2)
        assert h1 is not None
        assert h2 is not None
        dist = hamming_distance(h1, h2)
        assert dist == 0, f"Identical images should have distance 0, got {dist}"

    def test_slightly_different(self, slightly_different_images):
        from peakpick_ml.hasher import phash, hamming_distance

        p1, p2 = slightly_different_images
        h1 = phash(p1)
        h2 = phash(p2)
        assert h1 is not None
        assert h2 is not None
        dist = hamming_distance(h1, h2)
        # Allow fairly generous threshold — the images are identical content
        # but JPEG encoding introduces small variations
        assert dist < 25, f"Similar content should have distance < 25, got {dist}"

    def test_nonexistent_file(self):
        from peakpick_ml.hasher import phash

        h = phash("/nonexistent/image.jpg")
        assert h is None


class TestFindSimilarGroups:
    def test_no_groups_for_different(self, different_images):
        from peakpick_ml.hasher import compute_phash, find_similar_groups

        p1, p2 = different_images
        h1 = compute_phash(p1)
        h2 = compute_phash(p2)
        assert h1 is not None
        assert h2 is not None

        hashes = {p1: h1, p2: h2}
        groups = find_similar_groups(hashes, threshold=10)
        assert len(groups) == 0, "Different images should not form groups"

    def test_group_for_identical(self, identical_images):
        from peakpick_ml.hasher import compute_phash, find_similar_groups

        p1, p2 = identical_images
        h1 = compute_phash(p1)
        h2 = compute_phash(p2)
        assert h1 is not None
        assert h2 is not None

        hashes = {p1: h1, p2: h2}
        groups = find_similar_groups(hashes, threshold=10)
        assert len(groups) == 1, "Identical images should form 1 group"
        assert len(groups[0]) == 2, "Group should have 2 members"
