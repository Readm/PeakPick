-- PeakPick Database Schema
-- SQLite 3

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

CREATE INDEX idx_photos_status ON photos(status);
CREATE INDEX idx_photos_score ON photos(score);
CREATE INDEX idx_photos_date ON photos(date_taken);
CREATE INDEX idx_photos_locked ON photos(locked);

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

CREATE INDEX idx_group_members_photo ON photo_group_members(photo_id);

CREATE TABLE IF NOT EXISTS feedback_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id      INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    old_score     REAL NOT NULL,
    new_score     REAL NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_photo ON feedback_log(photo_id);
CREATE INDEX idx_feedback_date ON feedback_log(created_at);

CREATE TABLE IF NOT EXISTS ml_model_state (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name    TEXT NOT NULL DEFAULT 'clip-vit-l',
    backend       TEXT NOT NULL DEFAULT 'cpu',
    version       TEXT NOT NULL DEFAULT '0.1.0',
    photos_scored INTEGER NOT NULL DEFAULT 0,
    feedback_samples INTEGER NOT NULL DEFAULT 0,
    last_trained  TEXT,
    metadata      TEXT, -- JSON blob
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
