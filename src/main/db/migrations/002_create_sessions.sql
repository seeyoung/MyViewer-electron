-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  archive_path TEXT NOT NULL UNIQUE,
  current_page_index INTEGER NOT NULL,
  reading_direction TEXT NOT NULL DEFAULT 'ltr',
  view_mode TEXT NOT NULL DEFAULT 'single',
  zoom_level REAL NOT NULL DEFAULT 1.0,
  fit_mode TEXT NOT NULL DEFAULT 'fit_width',
  rotation INTEGER NOT NULL DEFAULT 0,
  show_thumbnails INTEGER NOT NULL DEFAULT 1,
  show_folder_tree INTEGER NOT NULL DEFAULT 0,
  show_bookmarks INTEGER NOT NULL DEFAULT 0,
  active_folder_id TEXT,
  search_query TEXT,
  started_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);

-- Create index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at DESC);
