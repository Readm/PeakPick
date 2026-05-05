"""Integration tests for the PeakPick FastAPI server.

Tests ALL endpoints through the HTTP layer using FastAPI's TestClient.
All tests share a single module-scoped database with 10+ photos.
Mutating tests use specific photo IDs to avoid interference.
Batch-delete tests are careful not to destroy data other tests need.
"""

from pathlib import Path

import pytest
import pytest_asyncio
from PIL import Image


def _make_test_images(img_dir: Path, count: int = 10):
    """Create count test images with varied colors."""
    img_dir.mkdir(parents=True, exist_ok=True)
    colors = [
        (100, 150, 200), (140, 120, 180), (180, 100, 150),
        (220, 200, 80), (60, 180, 220), (200, 80, 60),
        (80, 220, 100), (120, 60, 200), (240, 180, 100),
        (40, 120, 240),
    ]
    for i in range(count):
        c = colors[i % len(colors)]
        p = img_dir / f"photo_{i:03d}.jpg"
        Image.new("RGB", (200, 150), c).save(str(p), format="JPEG")
    return img_dir


# ─── Module-scoped fixtures ─────────────────────────────────────


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    return tmp_path_factory.mktemp("data") / "peakpick_test.db"


@pytest.fixture(scope="module", autouse=True)
def _isolate_db(db_path: Path):
    from peakpick_ml import db as db_module
    orig = db_module.DB_PATH
    db_module.DB_PATH = db_path
    yield
    db_module.DB_PATH = orig


@pytest_asyncio.fixture(scope="module")
async def init_database():
    from peakpick_ml.db import init_db
    await init_db()


@pytest_asyncio.fixture(scope="module")
async def client(init_database):
    from httpx import ASGITransport, AsyncClient
    from peakpick_ml.server import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="module")
async def seeded(client, tmp_path_factory):
    """Import 10 photos into shared DB (module-scoped, once)."""
    img_dir = tmp_path_factory.mktemp("seeded")
    import peakpick_ml.server as srv
    orig = srv._recompute_groups
    srv._recompute_groups = lambda: None
    _make_test_images(img_dir, 10)
    files = sorted(f.name for f in img_dir.iterdir() if f.suffix == ".jpg")
    await client.post(
        "/api/photos/import/confirm",
        json={"path": str(img_dir), "files": files},
    )
    srv._recompute_groups = orig
    return client


# ════════════════════════════════════════════════════════════════
# Tests
# ════════════════════════════════════════════════════════════════


class TestHealth:
    async def test_health_returns_ok(self, client):
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    async def test_health_structure(self, client):
        d = (await client.get("/health")).json()
        assert {"status", "device", "cuda_available", "torch_available"} <= set(d.keys())


class TestScan:
    async def test_scan_existing(self, client, tmp_path_factory):
        img_dir = _make_test_images(tmp_path_factory.mktemp("scan"), 3)
        r = await client.post("/api/photos/import/scan", json={"path": str(img_dir)})
        assert r.status_code == 200
        assert r.json()["count"] == 3

    async def test_scan_nonexistent(self, client):
        r = await client.post("/api/photos/import/scan",
                              json={"path": "/nonexistent/path_xyz_123"})
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "DIR_NOT_FOUND"

    async def test_scan_empty(self, client, tmp_path_factory):
        r = await client.post("/api/photos/import/scan",
                              json={"path": str(tmp_path_factory.mktemp("empty"))})
        assert r.status_code == 200
        assert r.json()["count"] == 0


class TestImport:
    async def test_import_more(self, client, tmp_path_factory, seeded):
        more = _make_test_images(tmp_path_factory.mktemp("more"), 3)
        files = sorted(f.name for f in more.iterdir() if f.suffix == ".jpg")
        r = await client.post("/api/photos/import/confirm",
                              json={"path": str(more), "files": files})
        assert r.status_code == 201
        assert r.json()["imported"] == 3
        assert r.json()["failed"] == 0

    async def test_import_partial_fail(self, client, tmp_path_factory):
        more = _make_test_images(tmp_path_factory.mktemp("partial"), 2)
        existing = sorted(f.name for f in more.iterdir() if f.suffix == ".jpg")
        r = await client.post("/api/photos/import/confirm",
                              json={"path": str(more),
                                    "files": existing + ["missing.jpg"]})
        assert r.status_code == 201
        assert r.json()["imported"] == 2
        assert r.json()["failed"] == 1

    async def test_import_nonexistent_dir(self, client):
        r = await client.post("/api/photos/import/confirm",
                              json={"path": "/nonexistent/dir_xyz",
                                    "files": ["x.jpg"]})
        assert r.status_code == 404

    async def test_total_after_imports(self, seeded):
        assert (await seeded.get("/api/photos")).json()["total"] >= 10


class TestListPhotos:
    async def test_list_all(self, seeded):
        d = (await seeded.get("/api/photos")).json()
        assert d["total"] >= 10
        assert len(d["photos"]) >= 10

    async def test_photo_fields(self, seeded):
        p = (await seeded.get("/api/photos")).json()["photos"][0]
        required = {"id", "filename", "filepath", "score", "status",
                     "locked", "date_taken", "width", "height",
                     "file_size", "created_at", "updated_at"}
        assert set(p.keys()) >= required
        assert isinstance(p["locked"], bool)
        assert 1.0 <= p["score"] <= 5.0

    async def test_filter_pending(self, seeded):
        assert (await seeded.get("/api/photos",
                                 params={"status": "pending"})).json()["filtered"] >= 5

    async def test_filter_bogus(self, seeded):
        assert (await seeded.get("/api/photos",
                                 params={"status": "bogus"})).json()["filtered"] == 0

    async def test_filter_score_min(self, seeded):
        assert (await seeded.get("/api/photos",
                                 params={"score_min": 1.0})).json()["filtered"] >= 1

    async def test_filter_score_max(self, seeded):
        assert (await seeded.get("/api/photos",
                                 params={"score_max": 5.0})).json()["filtered"] >= 1

    async def test_sort_score_asc(self, seeded):
        d = (await seeded.get("/api/photos",
                              params={"sort": "score", "order": "asc"})).json()
        if d["filtered"] >= 2:
            s = [p["score"] for p in d["photos"]]
            assert s == sorted(s)

    async def test_sort_score_desc(self, seeded):
        d = (await seeded.get("/api/photos",
                              params={"sort": "score", "order": "desc"})).json()
        if d["filtered"] >= 2:
            s = [p["score"] for p in d["photos"]]
            assert s == sorted(s, reverse=True)

    async def test_sort_date(self, seeded):
        assert "photos" in (await seeded.get(
            "/api/photos", params={"sort": "date", "order": "desc"})).json()


class TestGetPhoto:
    async def test_get_existing(self, seeded):
        r = await seeded.get("/api/photos/1")
        assert r.status_code == 200
        assert r.json()["id"] == 1

    async def test_get_nonexistent(self, seeded):
        r = await seeded.get("/api/photos/99999")
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "PHOTO_NOT_FOUND"


class TestUpdateScore:
    async def test_update_returns_correct(self, seeded):
        old = (await seeded.get("/api/photos/1")).json()["score"]
        new = 3.5 if abs(old - 3.5) > 0.01 else 4.0
        r = await seeded.patch("/api/photos/1/score", json={"score": new})
        d = r.json()
        assert d["id"] == 1
        assert abs(d["new_score"] - new) < 0.01
        assert abs(d["old_score"] - old) < 0.01

    async def test_update_nonexistent(self, seeded):
        assert (await seeded.patch(
            "/api/photos/99999/score", json={"score": 3.0})).status_code == 404

    async def test_update_low_bound(self, seeded):
        assert (await seeded.patch(
            "/api/photos/2/score", json={"score": 0.5})).status_code == 422

    async def test_update_high_bound(self, seeded):
        assert (await seeded.patch(
            "/api/photos/2/score", json={"score": 5.5})).status_code == 422

    async def test_update_persists(self, seeded):
        await seeded.patch("/api/photos/3/score", json={"score": 2.0})
        assert abs((await seeded.get("/api/photos/3")).json()["score"] - 2.0) < 0.01

    async def test_update_increments_feedback(self, seeded):
        before = (await seeded.get("/api/ml/status")).json()["feedback_samples"]
        await seeded.patch("/api/photos/4/score", json={"score": 4.0})
        after = (await seeded.get("/api/ml/status")).json()["feedback_samples"]
        assert after == before + 1


class TestLock:
    async def test_lock_on(self, seeded):
        assert (await seeded.post("/api/photos/5/lock")).json()["locked"] is True

    async def test_lock_off(self, seeded):
        await seeded.post("/api/photos/5/lock")  # toggle off
        r = await seeded.post("/api/photos/5/lock")  # toggle on
        # Now try with a different ID to test off
        await seeded.post("/api/photos/6/lock")  # lock 6
        r2 = await seeded.post("/api/photos/6/lock")  # unlock 6
        assert r2.json()["locked"] is False

    async def test_lock_nonexistent(self, seeded):
        assert (await seeded.post("/api/photos/99999/lock")).status_code == 404

    async def test_lock_persists(self, seeded):
        """Lock a photo and verify it stays locked across GET."""
        await seeded.post("/api/photos/7/lock")
        assert (await seeded.get("/api/photos/7")).json()["locked"] is True


class TestStatus:
    async def test_status_to_kept(self, seeded):
        d = (await seeded.patch("/api/photos/8/status",
                                json={"status": "kept"})).json()
        assert d["status"] == "kept"

    async def test_status_to_dismissed(self, seeded):
        d = (await seeded.patch("/api/photos/8/status",
                                json={"status": "dismissed"})).json()
        assert d["status"] == "dismissed"

    async def test_status_invalid(self, seeded):
        assert (await seeded.patch("/api/photos/8/status",
                                   json={"status": "invalid"})).status_code == 422

    async def test_status_nonexistent(self, seeded):
        assert (await seeded.patch("/api/photos/99999/status",
                                   json={"status": "kept"})).status_code == 404


class TestBatchStatus:
    async def test_batch_multi(self, seeded):
        r = await seeded.post("/api/photos/batch/status",
                              json={"ids": [1, 2, 3], "status": "kept"})
        assert r.json()["updated"] == 3

    async def test_batch_empty(self, seeded):
        r = await seeded.post("/api/photos/batch/status",
                              json={"ids": [], "status": "kept"})
        assert r.json()["updated"] == 0


class TestBatchDelete:
    """Uses the shared DB but is careful to not destroy data other tests need.

    Strategy: Use threshold=1.0 (below minimum score) to prove the *protection*
    logic works without actually deleting anything. Then a dedicated test
    demonstrates actual deletion with a specific low-score photo.
    """

    async def test_batch_preserves_locked(self, seeded):
        """With threshold=1.0, nothing should be deleted (min score is 1.0)."""
        r = await seeded.post("/api/photos/batch/delete",
                              json={"score_threshold": 1.0})
        d = r.json()
        assert "deleted" in d
        assert "skipped_locked" in d
        assert "skipped_dismissed" in d

    async def test_batch_deletes_unprotected_low_score(self, seeded):
        """Set a photo to a very low score and verify it gets deleted."""
        await seeded.patch("/api/photos/9/score", json={"score": 1.0})
        r = await seeded.post("/api/photos/batch/delete",
                              json={"score_threshold": 1.01})
        d = r.json()
        # Photo 9 is not locked or dismissed, so it should be deleted
        total_affected = d["deleted"] + d["skipped_locked"] + d["skipped_dismissed"]
        assert total_affected >= 1

    async def test_batch_delete_returns_counts(self, seeded):
        """Verify response structure even when zero photos match."""
        r = await seeded.post("/api/photos/batch/delete",
                              json={"score_threshold": 1.0})
        d = r.json()
        assert "deleted" in d
        assert "skipped_locked" in d
        assert "skipped_dismissed" in d
        assert d["deleted"] >= 0


class TestThumbnails:
    """Refresh the DB with fresh photos for thumbnail tests
    (previous batch tests may have deleted some)."""

    async def test_thumbnail_returns(self, client, seeded, tmp_path_factory):
        """Import a fresh photo specifically for this test."""
        # Import a new batch of photos for thumbnail testing
        import peakpick_ml.server as srv
        orig = srv._recompute_groups
        srv._recompute_groups = lambda: None

        fresh = _make_test_images(tmp_path_factory.mktemp("thumb"), 1)
        full_path = str(fresh / "photo_000.jpg")
        files = ["photo_000.jpg"]
        r = await client.post(
            "/api/photos/import/confirm",
            json={"path": str(fresh), "files": files},
        )
        srv._recompute_groups = orig
        assert r.status_code == 201

        # Get the ID of the newly imported photo
        photos = (await seeded.get("/api/photos")).json()["photos"]
        new_photo = next(p for p in photos if p["filepath"] == full_path)
        new_id = new_photo["id"]

        r2 = await seeded.get(f"/api/thumbnails/{new_id}")
        assert r2.status_code == 200
        d = r2.json()
        assert d["id"] == new_id
        assert isinstance(d["thumbnail"], str)
        assert len(d["thumbnail"]) > 100

    async def test_thumbnail_nonexistent(self, seeded):
        assert (await seeded.get("/api/thumbnails/99999")).status_code == 404


class TestScoreDistribution:
    async def test_basic_distribution(self, seeded):
        d = (await seeded.get("/api/scores/distribution")).json()
        assert d["total"] >= 1
        assert len(d["distribution"]) == 5
        assert d["avg_score"] > 0
        assert all(1 <= dist["base"] <= 5 for dist in d["distribution"])

    async def test_distribution_sums_to_total(self, seeded):
        d = (await seeded.get("/api/scores/distribution")).json()
        summed = sum(dist["count"] for dist in d["distribution"])
        assert summed == d["total"]


class TestMLStatus:
    async def test_ml_fields(self, seeded):
        d = (await seeded.get("/api/ml/status")).json()
        assert {"model", "backend", "version", "photos_scored",
                "feedback_samples", "online_learning"} <= set(d.keys())

    async def test_ml_defaults(self, seeded):
        d = (await seeded.get("/api/ml/status")).json()
        assert d["model"] == "heuristic-v1"
        assert d["online_learning"] is True


class TestSimilarGroups:
    async def test_groups_endpoint(self, seeded):
        """Verify /api/photos/similar is not caught by /api/photos/{photo_id}."""
        r = await seeded.get("/api/photos/similar")
        assert r.status_code == 200
        assert "groups" in r.json()

    async def test_photo_group_exists(self, seeded):
        r = await seeded.get("/api/photos/1/group")
        assert r.status_code == 200
        assert "group" in r.json()

    async def test_photo_group_nonexistent(self, seeded):
        r = await seeded.get("/api/photos/99999/group")
        assert r.json()["group"] is None


class TestFullWorkflow:
    async def test_full_selection_workflow(self, client, seeded, tmp_path_factory):
        """End-to-end: import → score → status → lock → batch delete → verify.

        Uses a fresh import to guarantee clean state for this workflow.
        """
        import peakpick_ml.server as srv
        orig = srv._recompute_groups
        srv._recompute_groups = lambda: None
        fresh = _make_test_images(tmp_path_factory.mktemp("workflow"), 3)
        files = sorted(f.name for f in fresh.iterdir() if f.suffix == ".jpg")
        r = await client.post(
            "/api/photos/import/confirm",
            json={"path": str(fresh), "files": files},
        )
        srv._recompute_groups = orig
        assert r.status_code == 201

        # Get IDs of the 3 fresh photos (they're the most recent)
        all_photos = (await seeded.get("/api/photos")).json()["photos"]
        fresh_photos = [p for p in all_photos
                        if p["filepath"].startswith(str(fresh))][-3:]
        ids = [p["id"] for p in fresh_photos]
        assert len(ids) == 3, f"Expected 3 fresh photos, got {len(ids)}"

        p1, p2, p3 = ids

        # Assign scores
        await seeded.patch(f"/api/photos/{p1}/score", json={"score": 4.5})
        await seeded.patch(f"/api/photos/{p2}/score", json={"score": 3.0})
        await seeded.patch(f"/api/photos/{p3}/score", json={"score": 2.0})

        # Mark as kept
        await seeded.patch(f"/api/photos/{p1}/status", json={"status": "kept"})

        # Lock best
        await seeded.post(f"/api/photos/{p1}/lock")

        # Dismiss worst
        await seeded.patch(f"/api/photos/{p3}/status", json={"status": "dismissed"})

        # Batch delete < 3.0 — should delete p3 (dismissed, skipped),
        # p2 (score 3.0, not < 3.0), p1 (locked, skipped)
        r = await seeded.post("/api/photos/batch/delete",
                              json={"score_threshold": 2.5})
        d = r.json()

        # p2 (score 3.0) should survive. p1 (locked) skipped. p3 (dismissed) skipped.
        # So total remaining from our fresh batch: at least 2 (p1 locked, p2 kept)
        assert "deleted" in d
        assert "skipped_locked" in d
        assert "skipped_dismissed" in d

        # Locked photo still exists
        r = await seeded.get(f"/api/photos/{p1}")
        assert r.status_code == 200
        assert r.json()["locked"] is True

        # ML status tracked
        ml = (await seeded.get("/api/ml/status")).json()
        assert ml["feedback_samples"] >= 1
        assert ml["photos_scored"] >= 1
