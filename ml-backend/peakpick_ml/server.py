"""FastAPI server for PeakPick ML backend.

Handles photo scoring, import, user feedback, and ML status.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from peakpick_ml import __version__
from peakpick_ml.db import (
    batch_update_status,
    delete_below_threshold,
    get_ml_status,
    get_photo,
    get_photos,
    get_score_distribution,
    increment_photos_scored,
    init_db,
    insert_photos,
    log_feedback,
    toggle_lock,
    update_score,
    update_status,
)
from peakpick_ml.scanner import extract_metadata, scan_directory
from peakpick_ml.scorer import score_image
from peakpick_ml.thumbnails import get_thumbnail

logger = logging.getLogger(__name__)

# ── Lifespan ────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and resources on startup."""
    logger.info("PeakPick ML backend starting")
    await init_db()
    yield
    logger.info("PeakPick ML backend shutting down")


# ── FastAPI app ────────────────────────────────────────────────

app = FastAPI(
    title="PeakPick ML Backend",
    version=__version__,
    description="Photo scoring and preference learning API",
    lifespan=lifespan,
)

# CORS for the Tauri frontend on localhost:1420
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ────────────────────────────────────────────

class ScanRequest(BaseModel):
    path: str


class ConfirmImportRequest(BaseModel):
    path: str
    files: list[str]


class ScoreUpdateRequest(BaseModel):
    score: float = Field(..., ge=1.0, le=5.0)


class StatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern=r"^(pending|kept|dismissed)$")


class BatchStatusRequest(BaseModel):
    ids: list[int]
    status: str = Field(..., pattern=r"^(pending|kept|dismissed)$")


class BatchDeleteRequest(BaseModel):
    score_threshold: float = Field(..., ge=1.0, le=5.0)


# ── Helper ──────────────────────────────────────────────────────

def _error_response(error: str, code: str, status_code: int = 400):
    """Raise an HTTP exception with a structured error response."""
    raise HTTPException(
        status_code=status_code,
        detail={"error": error, "code": code},
    )


# ── Routes ─────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "device": "cpu",
        "cuda_available": False,
        "torch_available": False,
    }


@app.get("/api/photos")
async def list_photos(
    status: Optional[str] = None,
    score_min: Optional[float] = None,
    score_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    locked: Optional[bool] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
):
    """List photos with optional filtering."""
    filters: dict[str, Any] = {}
    if status:
        filters["status"] = status
    if score_min is not None:
        filters["score_min"] = score_min
    if score_max is not None:
        filters["score_max"] = score_max
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to
    if search:
        filters["search"] = search
    if locked is not None:
        filters["locked"] = locked
    if sort:
        filters["sort"] = sort
    if order:
        filters["order"] = order

    photos, total = await get_photos(filters)
    return {
        "photos": photos,
        "total": total,
        "filtered": len(photos),
    }


@app.get("/api/photos/{photo_id}")
async def get_photo_detail(photo_id: int):
    """Get a single photo by ID."""
    photo = await get_photo(photo_id)
    if photo is None:
        _error_response("Photo not found", "PHOTO_NOT_FOUND", 404)
    return photo


@app.get("/api/photos/similar")
async def get_similar_groups():
    """Get similar photo groups. Placeholder — returns empty list."""
    return {"groups": []}


@app.post("/api/photos/import/scan")
async def import_scan(request: ScanRequest):
    """Scan a directory for importable image files."""
    try:
        files = scan_directory(request.path)
    except FileNotFoundError:
        _error_response(f"Directory not found: {request.path}", "DIR_NOT_FOUND", 404)
    except NotADirectoryError:
        _error_response(f"Not a directory: {request.path}", "NOT_A_DIR", 400)
    except PermissionError:
        _error_response(f"Permission denied: {request.path}", "PERMISSION_DENIED", 403)

    if not files:
        return {"count": 0, "date_range": None, "files": []}

    # Extract date range from metadata
    dates = []
    filenames = []
    for f in files:
        filenames.append(f["filename"])
        meta = extract_metadata(f["filepath"])
        if meta.get("date_taken"):
            dates.append(meta["date_taken"])

    date_range = None
    if dates:
        sorted_dates = sorted(dates)
        date_range = {"min": sorted_dates[0], "max": sorted_dates[-1]}

    return {
        "count": len(files),
        "date_range": date_range,
        "files": filenames,
    }


@app.post("/api/photos/import/confirm", status_code=201)
async def import_confirm(request: ConfirmImportRequest):
    """Confirm import of scanned files into the database."""
    base_path = Path(request.path).expanduser().resolve()
    if not base_path.exists():
        _error_response(f"Directory not found: {request.path}", "DIR_NOT_FOUND", 404)

    imported_count = 0
    failed_count = 0
    scores: list[float] = []
    photos_to_insert: list[dict[str, Any]] = []

    for filename in request.files:
        if "/" in filename or "\\" in filename:
            filepath = Path(filename)
        else:
            filepath = base_path / filename

        if not filepath.exists():
            logger.warning("File not found: %s", filepath)
            failed_count += 1
            continue

        try:
            meta = extract_metadata(str(filepath))
            score = score_image(str(filepath))

            photos_to_insert.append(
                {
                    "filename": filepath.name,
                    "filepath": str(filepath),
                    "score": score,
                    "date_taken": meta.get("date_taken"),
                    "width": meta.get("width"),
                    "height": meta.get("height"),
                    "file_size": meta.get("file_size"),
                }
            )
            scores.append(score)
        except Exception as e:
            logger.warning("Failed to process %s: %s", filepath, e)
            failed_count += 1

    if photos_to_insert:
        inserted = await insert_photos(photos_to_insert)
        imported_count = inserted
        await increment_photos_scored(inserted)

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

    # Log the import
    try:
        from peakpick_ml.db import get_db
        db = await get_db()
        await db.execute(
            """INSERT INTO import_log
               (source_path, file_count, success_count, failed_count, avg_score)
               VALUES (?, ?, ?, ?, ?)""",
            (request.path, len(request.files), imported_count, failed_count, avg_score),
        )
        await db.commit()
        await db.close()
    except Exception as e:
        logger.warning("Could not log import: %s", e)

    return {
        "imported": imported_count,
        "failed": failed_count,
        "avg_score": avg_score,
    }


@app.patch("/api/photos/{photo_id}/score")
async def update_photo_score(photo_id: int, request: ScoreUpdateRequest):
    """Update a photo's score and log the feedback."""
    photo = await get_photo(photo_id)
    if photo is None:
        _error_response("Photo not found", "PHOTO_NOT_FOUND", 404)

    old_score = photo["score"]
    new_score = request.score

    updated = await update_score(photo_id, new_score)
    if not updated:
        _error_response("Photo not found", "PHOTO_NOT_FOUND", 404)

    await log_feedback(photo_id, old_score, new_score)

    return {
        "id": photo_id,
        "old_score": old_score,
        "new_score": new_score,
        "model_updated": False,  # Heuristic model doesn't learn online
    }


@app.post("/api/photos/{photo_id}/lock")
async def toggle_photo_lock(photo_id: int):
    """Toggle the locked status of a photo."""
    new_locked = await toggle_lock(photo_id)
    if new_locked is None:
        _error_response("Photo not found", "PHOTO_NOT_FOUND", 404)

    return {"id": photo_id, "locked": new_locked}


@app.patch("/api/photos/{photo_id}/status")
async def update_photo_status(photo_id: int, request: StatusUpdateRequest):
    """Update a photo's status."""
    updated = await update_status(photo_id, request.status)
    if not updated:
        _error_response("Photo not found", "PHOTO_NOT_FOUND", 404)

    return {"id": photo_id, "status": request.status}


@app.post("/api/photos/batch/delete")
async def batch_delete_photos(request: BatchDeleteRequest):
    """Delete photos below a score threshold (excluding locked + dismissed)."""
    result = await delete_below_threshold(request.score_threshold)
    return result


@app.post("/api/photos/batch/status")
async def batch_update_photo_status(request: BatchStatusRequest):
    """Batch update status for multiple photos."""
    updated = await batch_update_status(request.ids, request.status)
    return {"updated": updated}


@app.get("/api/scores/distribution")
async def score_distribution():
    """Get score distribution statistics."""
    return await get_score_distribution()


@app.get("/api/ml/status")
async def ml_status():
    """Get ML backend status."""
    status = await get_ml_status()
    status["online_learning"] = True
    return status


@app.get("/api/thumbnails/{photo_id}")
async def thumbnail(photo_id: int):
    """Get a base64-encoded thumbnail for a photo."""
    photo = await get_photo(photo_id)
    if photo is None:
        _error_response("Photo not found", "PHOTO_NOT_FOUND", 404)

    thumb_b64 = get_thumbnail(photo["filepath"])
    if thumb_b64 is None:
        _error_response("Could not generate thumbnail", "THUMBNAIL_ERROR", 500)

    return {"id": photo_id, "thumbnail": thumb_b64}
