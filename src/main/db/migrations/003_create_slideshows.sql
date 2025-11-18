CREATE TABLE IF NOT EXISTS slideshows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  allow_duplicates INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS slideshow_entries (
  slideshow_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  source_path TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('folder', 'archive')),
  label TEXT NOT NULL,
  PRIMARY KEY (slideshow_id, position),
  FOREIGN KEY (slideshow_id) REFERENCES slideshows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slideshow_entries ON slideshow_entries(slideshow_id, position);
