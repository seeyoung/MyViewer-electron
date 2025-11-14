-- Create playlist_playback_state table (single row table)
CREATE TABLE IF NOT EXISTS playlist_playback_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),  -- Ensure only one row
  active_playlist_id TEXT,
  current_entry_index INTEGER NOT NULL DEFAULT -1,
  is_playing BOOLEAN NOT NULL DEFAULT 0,
  auto_advance_to_next_entry BOOLEAN NOT NULL DEFAULT 1,
  loop_mode TEXT NOT NULL DEFAULT 'none' CHECK(loop_mode IN ('none', 'playlist', 'entry')),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (active_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
);

-- Insert default row
INSERT OR IGNORE INTO playlist_playback_state (id, updated_at)
VALUES (1, strftime('%s', 'now') * 1000);
