"""FastAPI server for PeakPick ML backend.

Handles photo scoring, user feedback ingestion, and online learning.
"""

import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel

from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Optional ML dependencies — torch is only needed for scoring
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False
    logger.warning("torch not installed — ML scoring disabled")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup ML models + database connections."""
    device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
    logger.info(f"PeakPick ML backend starting on {device}")
    yield
    logger.info("PeakPick ML backend shutting down")


app = FastAPI(
    title="PeakPick ML Backend",
    version="0.1.0",
    description="Photo scoring and preference learning API",
    lifespan=lifespan,
)


# ── Data models ──────────────────────────────────────────────

class ScoreRequest(BaseModel):
    """Request to score a batch of photos."""
    photo_ids: list[str]


class ScoreResponse(BaseModel):
    """Individual photo score result."""
    photo_id: str
    score: float
    embedding: Optional[list[float]] = None


class FeedbackItem(BaseModel):
    """User feedback correcting an auto-score."""
    photo_id: str
    user_score: float
    auto_score: float


class FeedbackResponse(BaseModel):
    """Result of ingesting user feedback."""
    accepted: bool
    samples_seen: int


class BatchDeleteRequest(BaseModel):
    """Request to identify photos below a score threshold."""
    threshold: float


# ── Routes ───────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "device": "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu",
        "cuda_available": TORCH_AVAILABLE and torch.cuda.is_available(),
        "torch_available": TORCH_AVAILABLE,
    }


@app.post("/score", response_model=list[ScoreResponse])
async def score_photos(request: ScoreRequest):
    """Score a batch of photos using the active model."""
    # TODO: implement scoring
    return [
        ScoreResponse(photo_id=pid, score=0.5)
        for pid in request.photo_ids
    ]


@app.post("/feedback", response_model=FeedbackResponse)
async def ingest_feedback(feedback: list[FeedbackItem]):
    """Ingest user feedback for online learning."""
    # TODO: implement online learning
    return FeedbackResponse(accepted=True, samples_seen=len(feedback))


@app.post("/batch-delete-candidates")
async def batch_delete_candidates(request: BatchDeleteRequest):
    """List photo IDs with scores below threshold."""
    # TODO: implement threshold query
    return {"photo_ids": [], "threshold": request.threshold}


@app.post("/import-photos")
async def import_photos(files: list[UploadFile] = File(...)):
    """Import uploaded photos into the library."""
    # TODO: implement import
    return {"imported": len(files), "photo_ids": []}
