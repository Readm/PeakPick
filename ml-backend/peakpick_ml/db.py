"""SQLite database layer for PeakPick ML backend.

Uses aiosqlite for async database operations.
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path.home() / ".peakpick" / "peakpick.db"


def _get_db_path() -> str:
    """Return the database path, ensuring the parent directory exists."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return str(DB_PATH)


CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,
    filepath      TEXT NOT NULL UNIQUE,
    score         REAL NOT NULL DEFAULT 3.0,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'kept', 'dismissed')),
    locked        INTEGER NOT NULL DEFAULT 0,
    date_taken    TEXT,
    width         INTEGER,
    height        INTEGER,
    file_size     INTEGER,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_score ON photos(score);
CREATE INDEX IF NOT EXISTS idx_photos_date ON photos(date_taken);
CREATE INDEX IF NOT EXISTS idx_photos_locked ON photos(locked);

CREATE TABLE IF NOT EXISTS photo_groups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    description   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS photo_group_members (
    group_id      INTEGER NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
    photo_id      INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    similarity    REAL NOT NULL DEFAULT 1.0,
    is_best       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_photo ON photo_group_members(photo_id);

CREATE TABLE IF NOT EXISTS feedback_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id      INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    old_score     REAL NOT NULL,
    new_score     REAL NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_photo ON feedback_log(photo_id);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback_log(created_at);

CREATE TABLE IF NOT EXISTS ml_model_state (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name    TEXT NOT NULL DEFAULT 'heuristic-v1',
    backend       TEXT NOT NULL DEFAULT 'cpu',
    version       TEXT NOT NULL DEFAULT '0.1.0',
    photos_scored INTEGER NOT NULL DEFAULT 0,
    feedback_samples INTEGER NOT NULL DEFAULT 0,
    last_trained  TEXT,
    metadata      TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path   TEXT NOT NULL,
    file_count    INTEGER NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count  INTEGER NOT NULL DEFAULT 0,
    avg_score     REAL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def init_db() -> None:
    """Initialize the database, creating tables if they don't exist."""
    db_path = _get_db_path()
    logger.info("Initializing database at %s", db_path)
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(CREATE_TABLES_SQL)

        # Ensure a default ml_model_state row exists
        cursor = await db.execute("SELECT COUNT(*) FROM ml_model_state")
        row = await cursor.fetchone()
        if row and row[0] == 0:
            await db.execute(
                """INSERT INTO ml_model_state
                   (model_name, backend, version, photos_scored, feedback_samples, metadata)
                   VALUES (?, ?, ?, 0, 0, ?)""",
                ("heuristic-v1", "cpu", "0.1.0", json.dumps({"type": "heuristic"})),
            )
        await db.commit()


async def get_db() -> aiosqlite.Connection:
    """Return a new database connection."""
    db_path = _get_db_path()
    conn = await aiosqlite.connect(db_path)
    conn.row_factory = aiosqlite.Row
    return conn


def _photo_row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    """Convert a photo row to a dictionary."""
    return {
        "id": row["id"],
        "filename": row["filename"],
        "filepath": row["filepath"],
        "score": row["score"],
        "status": row["status"],
        "locked": bool(row["locked"]),
        "date_taken": row["date_taken"],
        "width": row["width"],
        "height": row["height"],
        "file_size": row["file_size"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# ── Query functions ────────────────────────────────────────────


async def get_photos(
    filters: Optional[dict[str, Any]] = None,
) -> tuple[list[dict[str, Any]], int]:
    """Get photos with optional filtering.

    Args:
        filters: Dict with keys: status, score_min, score_max, date_from,
                 date_to, search, locked, sort, order.

    Returns:
        Tuple of (list of photo dicts, total count before filtering).
    """
    filters = filters or {}
    db = await get_db()
    try:
        # Get total count
        cursor = await db.execute("SELECT COUNT(*) FROM photos")
        row = await cursor.fetchone()
        total = row[0] if row else 0

        # Build query
        where_clauses: list[str] = []
        params: list[Any] = []

        status = filters.get("status")
        if status and status != "all":
            where_clauses.append("status = ?")
            params.append(status)

        score_min = filters.get("score_min")
        if score_min is not None:
            where_clauses.append("score >= ?")
            params.append(score_min)

        score_max = filters.get("score_max")
        if score_max is not None:
            where_clauses.append("score <= ?")
            params.append(score_max)

        date_from = filters.get("date_from")
        if date_from:
            where_clauses.append("date_taken >= ?")
            params.append(date_from)

        date_to = filters.get("date_to")
        if date_to:
            where_clauses.append("date_taken <= ?")
            params.append(date_to)

        search = filters.get("search")
        if search:
            where_clauses.append("filename LIKE ?")
            params.append(f"%{search}%")

        locked = filters.get("locked")
        if locked is not None:
            where_clauses.append("locked = ?")
            params.append(1 if locked else 0)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        # Sorting
        sort_map = {
            "date": "date_taken",
            "score": "score",
            "filename": "filename",
        }
        sort_col = sort_map.get(filters.get("sort", "date"), "date_taken")
        order_dir = "DESC" if filters.get("order") == "desc" else "ASC"

        query = f"SELECT * FROM photos {where_sql} ORDER BY {sort_col} {order_dir}"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

        photos = [_photo_row_to_dict(r) for r in rows]
        return photos, total
    finally:
        await db.close()


async def get_photo(photo_id: int) -> Optional[dict[str, Any]]:
    """Get a single photo by ID.

    Args:
        photo_id: The photo ID.

    Returns:
        Photo dict or None if not found.
    """
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM photos WHERE id = ?", (photo_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return _photo_row_to_dict(row)
    finally:
        await db.close()


async def insert_photos(
    photos: list[dict[str, Any]],
) -> int:
    """Insert a list of photos into the database.

    Args:
        photos: List of dicts with keys: filename, filepath, score,
                date_taken, width, height, file_size.

    Returns:
        Number of successfully inserted photos.
    """
    db = await get_db()
    try:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        inserted = 0
        for photo in photos:
            try:
                await db.execute(
                    """INSERT OR IGNORE INTO photos
                       (filename, filepath, score, date_taken, width, height, file_size, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        photo["filename"],
                        photo["filepath"],
                        photo.get("score", 3.0),
                        photo.get("date_taken"),
                        photo.get("width"),
                        photo.get("height"),
                        photo.get("file_size"),
                        now,
                        now,
                    ),
                )
                if db.total_changes > 0:
                    inserted += 1
            except Exception as e:
                logger.warning("Failed to insert photo %s: %s", photo.get("filepath"), e)
        await db.commit()
        return inserted
    finally:
        await db.close()


async def update_score(photo_id: int, score: float) -> bool:
    """Update a photo's score.

    Args:
        photo_id: The photo ID.
        score: New score value.

    Returns:
        True if updated, False if photo not found.
    """
    db = await get_db()
    try:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        cursor = await db.execute(
            "UPDATE photos SET score = ?, updated_at = ? WHERE id = ?",
            (score, now, photo_id),
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def update_status(photo_id: int, status: str) -> bool:
    """Update a photo's status.

    Args:
        photo_id: The photo ID.
        status: New status ('pending', 'kept', 'dismissed').

    Returns:
        True if updated, False if photo not found.
    """
    db = await get_db()
    try:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        cursor = await db.execute(
            "UPDATE photos SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, photo_id),
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def toggle_lock(photo_id: int) -> Optional[bool]:
    """Toggle the locked status of a photo.

    Args:
        photo_id: The photo ID.

    Returns:
        New locked state, or None if photo not found.
    """
    db = await get_db()
    try:
        cursor = await db.execute("SELECT locked FROM photos WHERE id = ?", (photo_id,))
        row = await cursor.fetchone()
        if row is None:
            return None

        new_locked = 0 if row["locked"] else 1
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        await db.execute(
            "UPDATE photos SET locked = ?, updated_at = ? WHERE id = ?",
            (new_locked, now, photo_id),
        )
        await db.commit()
        return bool(new_locked)
    finally:
        await db.close()


async def delete_below_threshold(
    threshold: float,
) -> dict[str, int]:
    """Delete photos with score below threshold, excluding locked and dismissed.

    Args:
        threshold: Score threshold.

    Returns:
        Dict with deleted, skipped_locked, skipped_dismissed counts.
    """
    db = await get_db()
    try:
        # Count locked and dismissed that would be affected
        cursor = await db.execute(
            """SELECT
                SUM(CASE WHEN locked = 1 THEN 1 ELSE 0 END) as locked_count,
                SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed_count
             FROM photos WHERE score < ? AND (locked = 1 OR status = 'dismissed')""",
            (threshold,),
        )
        row = await cursor.fetchone()
        skipped_locked = row["locked_count"] if row and row["locked_count"] else 0
        skipped_dismissed = row["dismissed_count"] if row and row["dismissed_count"] else 0

        # Delete non-locked, non-dismissed photos below threshold
        cursor = await db.execute(
            """DELETE FROM photos
               WHERE score < ?
                 AND locked = 0
                 AND status != 'dismissed'""",
            (threshold,),
        )
        await db.commit()
        deleted = cursor.rowcount

        return {
            "deleted": deleted,
            "skipped_locked": skipped_locked,
            "skipped_dismissed": skipped_dismissed,
        }
    finally:
        await db.close()


async def get_score_distribution() -> dict[str, Any]:
    """Get score distribution statistics.

    Returns:
        Dict with distribution (5 bins), avg_score, total.
    """
    db = await get_db()
    try:
        cursor = await db.execute("SELECT score FROM photos")
        rows = await cursor.fetchall()
        scores = [r["score"] for r in rows]

        total = len(scores)
        if total == 0:
            return {
                "distribution": [
                    {"base": i, "count": 0, "percentage": 0.0} for i in range(1, 6)
                ],
                "avg_score": 0.0,
                "total": 0,
            }

        avg_score = sum(scores) / total

        distribution = []
        for base in range(1, 6):
            count = sum(1 for s in scores if int(s) == base)
            percentage = round((count / total) * 100, 1)
            distribution.append({"base": base, "count": count, "percentage": percentage})

        return {
            "distribution": distribution,
            "avg_score": round(avg_score, 1),
            "total": total,
        }
    finally:
        await db.close()


async def get_ml_status() -> dict[str, Any]:
    """Get ML backend status from the database."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM ml_model_state ORDER BY id DESC LIMIT 1"
        )
        row = await cursor.fetchone()

        if row is None:
            return {
                "model": "heuristic-v1",
                "backend": "cpu",
                "cuda_available": False,
                "version": "0.1.0",
                "photos_scored": 0,
                "feedback_samples": 0,
                "online_learning": True,
            }

        metadata = {}
        if row["metadata"]:
            try:
                metadata = json.loads(row["metadata"])
            except (json.JSONDecodeError, TypeError):
                pass

        return {
            "model": row["model_name"],
            "backend": row["backend"],
            "cuda_available": False,
            "version": row["version"],
            "photos_scored": row["photos_scored"],
            "feedback_samples": row["feedback_samples"],
            "online_learning": metadata.get("online_learning", True),
        }
    finally:
        await db.close()


async def log_feedback(
    photo_id: int,
    old_score: float,
    new_score: float,
) -> None:
    """Log a user feedback event.

    Args:
        photo_id: The photo ID.
        old_score: Previous score.
        new_score: New score.
    """
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO feedback_log (photo_id, old_score, new_score) VALUES (?, ?, ?)",
            (photo_id, old_score, new_score),
        )

        # Update feedback_samples count in ml_model_state
        await db.execute(
            """UPDATE ml_model_state
               SET feedback_samples = feedback_samples + 1
               WHERE id = (SELECT id FROM ml_model_state ORDER BY id DESC LIMIT 1)"""
        )

        await db.commit()
    finally:
        await db.close()


async def batch_update_status(photo_ids: list[int], status: str) -> int:
    """Batch update status for multiple photos.

    Args:
        photo_ids: List of photo IDs.
        status: New status value.

    Returns:
        Number of updated rows.
    """
    db = await get_db()
    try:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        placeholders = ",".join("?" for _ in photo_ids)
        query = f"UPDATE photos SET status = ?, updated_at = ? WHERE id IN ({placeholders})"
        cursor = await db.execute(query, [status, now, *photo_ids])
        await db.commit()
        return cursor.rowcount
    finally:
        await db.close()


async def increment_photos_scored(count: int = 1) -> None:
    """Increment the photos_scored counter in ml_model_state."""
    db = await get_db()
    try:
        await db.execute(
            """UPDATE ml_model_state
               SET photos_scored = photos_scored + ?
               WHERE id = (SELECT id FROM ml_model_state ORDER BY id DESC LIMIT 1)""",
            (count,),
        )
        await db.commit()
    finally:
        await db.close()
