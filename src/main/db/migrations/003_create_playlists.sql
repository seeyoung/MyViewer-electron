-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,  -- Unix timestamp in milliseconds
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_playlists_updated_at ON playlists(updated_at DESC);

-- Create playlist_entries table
CREATE TABLE IF NOT EXISTS playlist_entries (
  playlist_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  source_path TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('folder', 'archive')),
  label TEXT NOT NULL,
  thumbnail_path TEXT,
  PRIMARY KEY (playlist_id, position),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE INDEX idx_playlist_entries_position ON playlist_entries(playlist_id, position);
