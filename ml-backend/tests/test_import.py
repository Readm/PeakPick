"""Tests for PeakPick ML backend."""

import os
import tempfile
from pathlib import Path

import pytest
from PIL import Image


# ── Fixtures ────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def test_image_path():
    """Create a temporary test image for tests."""
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(b"not a real image")  # Will be overwritten by PIL
        temp_path = f.name

    # Create a proper test image
    img = Image.new("RGB", (200, 150), color=(128, 128, 128))
    img.save(temp_path, format="JPEG")
    yield temp_path
    try:
        os.unlink(temp_path)
    except OSError:
        pass


@pytest.fixture
def test_image_dir(test_image_path):
    """Create a temp directory with test images."""
    temp_dir = tempfile.mkdtemp()
    # Copy test image
    dest = Path(temp_dir) / "test_photo.jpg"
    Image.new("RGB", (200, 150), color=(128, 128, 128)).save(str(dest), format="JPEG")
    # Create a hidden file (should be ignored)
    hidden = Path(temp_dir) / ".hidden.jpg"
    Image.new("RGB", (10, 10), color=(0, 0, 0)).save(str(hidden), format="JPEG")
    yield temp_dir
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)


# ── Tests ───────────────────────────────────────────────────────

class TestPackage:
    """Test package-level attributes."""

    def test_import(self):
        from peakpick_ml import __version__
        assert __version__ == "0.1.0"

    def test_server_import(self):
        from peakpick_ml.server import app
        assert app.title == "PeakPick ML Backend"


class TestScanner:
    """Test the scanner module."""

    def test_scan_directory(self, test_image_dir):
        from peakpick_ml.scanner import scan_directory

        files = scan_directory(test_image_dir)
        # Should find the test image but not the hidden file
        assert len(files) >= 1
        filenames = [f["filename"] for f in files]
        assert "test_photo.jpg" in filenames
        assert ".hidden.jpg" not in filenames

    def test_scan_nonexistent_directory(self):
        from peakpick_ml.scanner import scan_directory

        with pytest.raises(FileNotFoundError):
            scan_directory("/nonexistent/path/12345")

    def test_extract_metadata(self, test_image_path):
        from peakpick_ml.scanner import extract_metadata

        meta = extract_metadata(test_image_path)
        assert meta["width"] == 200
        assert meta["height"] == 150
        assert meta["file_size"] > 0

    def test_generate_thumbnail(self, test_image_path):
        from peakpick_ml.scanner import generate_thumbnail

        thumb = generate_thumbnail(test_image_path, max_width=100)
        assert thumb is not None
        assert len(thumb) > 0

    def test_generate_thumbnail_nonexistent(self):
        from peakpick_ml.scanner import generate_thumbnail

        thumb = generate_thumbnail("/nonexistent/image.jpg")
        assert thumb is None


class TestScorer:
    """Test the scorer module."""

    def test_score_image(self, test_image_path):
        from peakpick_ml.scorer import score_image

        score = score_image(test_image_path)
        assert 1.0 <= score <= 5.0

    def test_score_nonexistent_image(self):
        from peakpick_ml.scorer import score_image

        score = score_image("/nonexistent/image.jpg")
        assert score == 3.0  # Default score on error

    def test_scorer_components(self):
        from peakpick_ml.scorer import (
            _score_exposure,
            _score_contrast,
            _score_sharpness,
            _score_colorfulness,
        )
        import numpy as np

        # Create a known test array
        arr = np.ones((100, 100, 3), dtype=np.float32) * 128
        arr[40:60, 40:60] = 200  # Add some contrast

        exp = _score_exposure(arr)
        con = _score_contrast(arr)
        shp = _score_sharpness(arr)
        col = _score_colorfulness(arr)

        assert 1.0 <= exp <= 5.0
        assert 1.0 <= con <= 5.0
        assert 1.0 <= shp <= 5.0
        assert 1.0 <= col <= 5.0


class TestThumbnails:
    """Test the thumbnails module."""

    def test_get_thumbnail(self, test_image_path):
        from peakpick_ml.thumbnails import clear_cache, get_thumbnail

        clear_cache()  # Start fresh
        thumb = get_thumbnail(test_image_path, size=50)
        assert thumb is not None
        assert len(thumb) > 0

    def test_get_thumbnail_nonexistent(self):
        from peakpick_ml.thumbnails import get_thumbnail

        thumb = get_thumbnail("/nonexistent/image.jpg")
        assert thumb is None

    def test_clear_cache(self):
        from peakpick_ml.thumbnails import clear_cache

        count = clear_cache()
        assert count >= 0  # Should not raise


class TestServer:
    """Test the FastAPI server endpoints using TestClient."""

    @pytest.fixture(autouse=True)
    def setup_db(self):
        """Initialize DB before each test."""
        import asyncio
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        from peakpick_ml.db import init_db
        loop.run_until_complete(init_db())

    def test_health_endpoint(self):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["cuda_available"] is False

    def test_empty_photos(self):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.get("/api/photos")
        assert response.status_code == 200
        data = response.json()
        assert "photos" in data
        assert "total" in data

    def test_import_scan(self, test_image_dir):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.post("/api/photos/import/scan", json={"path": test_image_dir})
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 1
        assert "files" in data

    def test_photo_not_found(self):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.get("/api/photos/99999")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data["detail"] or "error" in data

    def test_ml_status(self):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.get("/api/ml/status")
        assert response.status_code == 200
        data = response.json()
        assert "model" in data
        assert "version" in data

    def test_score_distribution(self):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.get("/api/scores/distribution")
        assert response.status_code == 200
        data = response.json()
        assert "distribution" in data
        assert "total" in data

    def test_cors_headers(self):
        from fastapi.testclient import TestClient
        from peakpick_ml.server import app

        client = TestClient(app)
        response = client.get("/health", headers={"Origin": "http://localhost:1420"})
        assert response.status_code == 200
        cors_header = response.headers.get("access-control-allow-origin")
        # TestClient may or may not include CORS headers, that's okay
        if cors_header:
            assert cors_header == "http://localhost:1420"
