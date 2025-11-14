import DatabaseConnection from '../db/connection';
import {
  Playlist,
  PlaylistEntry,
  PlaylistWithEntries,
  CreatePlaylistParams,
  UpdatePlaylistParams,
  CreatePlaylistEntryParams,
  UpdatePlaylistEntryParams,
} from '@shared/types/playlist';
import { randomUUID } from 'crypto';

/**
 * Playlist Repository
 * CRUD operations for playlists and playlist entries in SQLite
 */
export class PlaylistRepository {
  private db: any;

  constructor(dbInstance?: any) {
    this.db = dbInstance || DatabaseConnection.getInstance().getDb();
  }

  /**
   * Create a new playlist
   */
  createPlaylist(params: CreatePlaylistParams): Playlist {
    const now = Date.now();
    const playlist: Playlist = {
      id: randomUUID(),
      name: params.name,
      description: params.description,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO playlists (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      playlist.id,
      playlist.name,
      playlist.description || null,
      playlist.created_at,
      playlist.updated_at
    );

    return playlist;
  }

  /**
   * Get playlist by ID
   */
  getPlaylistById(id: string): Playlist | null {
    const stmt = this.db.prepare('SELECT * FROM playlists WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return this.rowToPlaylist(row);
  }

  /**
   * Get all playlists ordered by updated_at DESC
   */
  getAllPlaylists(): Playlist[] {
    const stmt = this.db.prepare('SELECT * FROM playlists ORDER BY updated_at DESC');
    const rows = stmt.all();
    return rows.map(row => this.rowToPlaylist(row));
  }

  /**
   * Update playlist
   */
  updatePlaylist(id: string, params: UpdatePlaylistParams): Playlist {
    const existing = this.getPlaylistById(id);
    if (!existing) {
      throw new Error(`Playlist not found: ${id}`);
    }

    const now = Date.now();
    const updates = {
      name: params.name !== undefined ? params.name : existing.name,
      description:
        params.description !== undefined ? params.description : existing.description,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      UPDATE playlists
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(updates.name, updates.description || null, updates.updated_at, id);

    return {
      ...existing,
      ...updates,
    };
  }

  /**
   * Delete playlist (cascade deletes entries)
   */
  deletePlaylist(id: string): void {
    const stmt = this.db.prepare('DELETE FROM playlists WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Add entry to playlist
   */
  addEntry(params: CreatePlaylistEntryParams): PlaylistEntry {
    const stmt = this.db.prepare(`
      INSERT INTO playlist_entries
        (playlist_id, position, source_path, source_type, label, thumbnail_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      params.playlist_id,
      params.position,
      params.source_path,
      params.source_type,
      params.label,
      params.thumbnail_path || null
    );

    return {
      playlist_id: params.playlist_id,
      position: params.position,
      source_path: params.source_path,
      source_type: params.source_type,
      label: params.label,
      thumbnail_path: params.thumbnail_path,
    };
  }

  /**
   * Get all entries for a playlist ordered by position
   */
  getEntries(playlistId: string): PlaylistEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM playlist_entries
      WHERE playlist_id = ?
      ORDER BY position ASC
    `);

    const rows = stmt.all(playlistId);
    return rows.map(row => this.rowToEntry(row));
  }

  /**
   * Get playlist with all its entries
   */
  getPlaylistWithEntries(id: string): PlaylistWithEntries | null {
    const playlist = this.getPlaylistById(id);
    if (!playlist) {
      return null;
    }

    const entries = this.getEntries(id);

    return {
      playlist,
      entries,
    };
  }

  /**
   * Remove entry and renumber subsequent positions
   */
  removeEntry(playlistId: string, position: number): void {
    // Delete the entry
    const deleteStmt = this.db.prepare(`
      DELETE FROM playlist_entries
      WHERE playlist_id = ? AND position = ?
    `);
    deleteStmt.run(playlistId, position);

    // Renumber subsequent entries
    const updateStmt = this.db.prepare(`
      UPDATE playlist_entries
      SET position = position - 1
      WHERE playlist_id = ? AND position > ?
    `);
    updateStmt.run(playlistId, position);
  }

  /**
   * Reorder entries (move from one position to another)
   */
  reorderEntries(playlistId: string, fromPosition: number, toPosition: number): PlaylistEntry[] {
    if (fromPosition === toPosition) {
      return this.getEntries(playlistId);
    }

    const entries = this.getEntries(playlistId);

    // Find the entry to move
    const entryToMove = entries.find(e => e.position === fromPosition);
    if (!entryToMove) {
      return entries;
    }

    // Remove entry from old position
    this.removeEntry(playlistId, fromPosition);

    // Shift entries to make space at new position
    if (toPosition < fromPosition) {
      // Moving up: shift entries down
      const shiftStmt = this.db.prepare(`
        UPDATE playlist_entries
        SET position = position + 1
        WHERE playlist_id = ? AND position >= ?
      `);
      shiftStmt.run(playlistId, toPosition);
    } else {
      // Moving down: positions already adjusted by removeEntry
      // Just need to ensure target position is correct
      const adjustedToPosition = toPosition - 1; // Account for removed entry
      const shiftStmt = this.db.prepare(`
        UPDATE playlist_entries
        SET position = position + 1
        WHERE playlist_id = ? AND position > ?
      `);
      shiftStmt.run(playlistId, adjustedToPosition);
    }

    // Insert entry at new position
    const insertStmt = this.db.prepare(`
      INSERT INTO playlist_entries
        (playlist_id, position, source_path, source_type, label, thumbnail_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      playlistId,
      toPosition,
      entryToMove.source_path,
      entryToMove.source_type,
      entryToMove.label,
      entryToMove.thumbnail_path || null
    );

    return this.getEntries(playlistId);
  }

  /**
   * Update entry fields
   */
  updateEntry(
    playlistId: string,
    position: number,
    params: UpdatePlaylistEntryParams
  ): PlaylistEntry {
    const existing = this.db
      .prepare('SELECT * FROM playlist_entries WHERE playlist_id = ? AND position = ?')
      .get(playlistId, position);

    if (!existing) {
      throw new Error(
        `Entry not found: playlist=${playlistId}, position=${position}`
      );
    }

    const updates = {
      label: params.label !== undefined ? params.label : existing.label,
      thumbnail_path:
        params.thumbnail_path !== undefined
          ? params.thumbnail_path
          : existing.thumbnail_path,
    };

    const stmt = this.db.prepare(`
      UPDATE playlist_entries
      SET label = ?, thumbnail_path = ?
      WHERE playlist_id = ? AND position = ?
    `);

    stmt.run(updates.label, updates.thumbnail_path || null, playlistId, position);

    return this.rowToEntry({
      ...existing,
      ...updates,
    });
  }

  /**
   * Add multiple entries at once with optional insert position
   */
  addEntriesBatch(
    entries: CreatePlaylistEntryParams[],
    insertPosition?: number
  ): PlaylistEntry[] {
    if (entries.length === 0) {
      return [];
    }

    const playlistId = entries[0].playlist_id;
    const existingEntries = this.getEntries(playlistId);

    // Determine insert position
    const targetPosition =
      insertPosition !== undefined ? insertPosition : existingEntries.length;

    // Shift existing entries to make space
    if (targetPosition < existingEntries.length) {
      const shiftStmt = this.db.prepare(`
        UPDATE playlist_entries
        SET position = position + ?
        WHERE playlist_id = ? AND position >= ?
      `);
      shiftStmt.run(entries.length, playlistId, targetPosition);
    }

    // Insert new entries
    const added: PlaylistEntry[] = [];
    entries.forEach((entry, index) => {
      const newEntry = {
        ...entry,
        position: targetPosition + index,
      };
      added.push(this.addEntry(newEntry));
    });

    return added;
  }

  /**
   * Convert database row to Playlist
   */
  private rowToPlaylist(row: any): Playlist {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Convert database row to PlaylistEntry
   */
  private rowToEntry(row: any): PlaylistEntry {
    return {
      playlist_id: row.playlist_id,
      position: row.position,
      source_path: row.source_path,
      source_type: row.source_type as 'folder' | 'archive',
      label: row.label,
      thumbnail_path: row.thumbnail_path || undefined,
    };
  }
}
