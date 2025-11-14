/**
 * Playlist metadata
 */
export interface Playlist {
  id: string; // UUID v4
  name: string; // User-defined name
  description?: string; // Optional description
  created_at: number; // Unix timestamp (ms)
  updated_at: number; // Unix timestamp (ms)
}

/**
 * Individual entry in a playlist
 */
export interface PlaylistEntry {
  playlist_id: string; // Foreign key to playlists.id
  position: number; // 0-based index (continuous integers)
  source_path: string; // Absolute path (MUST be sanitized)
  source_type: 'folder' | 'archive';
  label: string; // Display name (basename or user-defined)
  thumbnail_path?: string; // Optional cover image path
}

/**
 * Complete playlist with entries
 */
export interface PlaylistWithEntries {
  playlist: Playlist;
  entries: PlaylistEntry[];
}

/**
 * Playlist playback state
 */
export interface PlaylistPlaybackState {
  activePlaylistId: string | null;
  currentEntryIndex: number; // -1 if no entry selected
  isPlaying: boolean; // Auto-advance enabled
  autoAdvanceToNextEntry: boolean;
  loopMode: 'none' | 'playlist' | 'entry'; // Loop behavior
}

/**
 * Playlist creation parameters
 */
export interface CreatePlaylistParams {
  name: string;
  description?: string;
}

/**
 * Playlist update parameters
 */
export interface UpdatePlaylistParams {
  name?: string;
  description?: string;
}

/**
 * Playlist entry creation parameters
 */
export interface CreatePlaylistEntryParams {
  playlist_id: string;
  position: number;
  source_path: string;
  source_type: 'folder' | 'archive';
  label: string;
  thumbnail_path?: string;
}

/**
 * Playlist entry update parameters
 */
export interface UpdatePlaylistEntryParams {
  label?: string;
  thumbnail_path?: string;
}
