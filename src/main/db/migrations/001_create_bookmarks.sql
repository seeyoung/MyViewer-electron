-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  archive_path TEXT NOT NULL,
  image_id TEXT,
  page_index INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  thumbnail_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(archive_path, page_index)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_archive ON bookmarks(archive_path);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);
