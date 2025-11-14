import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  Playlist,
  PlaylistEntry,
  CreatePlaylistParams,
  UpdatePlaylistParams,
  CreatePlaylistEntryParams,
  UpdatePlaylistEntryParams,
} from '@shared/types/playlist';
import { randomUUID } from 'crypto';

// Mock electron module
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test',
  },
}));

import { PlaylistRepository } from './PlaylistRepository';

describe('PlaylistRepository', () => {
  let repository: PlaylistRepository;
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Run migration to create tables
    const migration = `
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

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
    `;
    db.exec(migration);

    // Create repository with test database
    repository = new PlaylistRepository(db);
  });

  afterEach(() => {
    // Close database
    db.close();
  });

  describe('createPlaylist', () => {
    it('should create a new playlist with generated ID and timestamps', () => {
      // Arrange
      const params: CreatePlaylistParams = {
        name: 'My Test Playlist',
        description: 'Test description',
      };

      // Act
      const playlist = repository.createPlaylist(params);

      // Assert
      expect(playlist).toBeDefined();
      expect(playlist.id).toBeTruthy();
      expect(playlist.name).toBe('My Test Playlist');
      expect(playlist.description).toBe('Test description');
      expect(playlist.created_at).toBeGreaterThan(0);
      expect(playlist.updated_at).toBe(playlist.created_at);
    });

    it('should create playlist without description', () => {
      // Arrange
      const params: CreatePlaylistParams = {
        name: 'Minimal Playlist',
      };

      // Act
      const playlist = repository.createPlaylist(params);

      // Assert
      expect(playlist.name).toBe('Minimal Playlist');
      expect(playlist.description).toBeUndefined();
    });

    it('should generate unique IDs for each playlist', () => {
      // Act
      const playlist1 = repository.createPlaylist({ name: 'Playlist 1' });
      const playlist2 = repository.createPlaylist({ name: 'Playlist 2' });

      // Assert
      expect(playlist1.id).not.toBe(playlist2.id);
    });
  });

  describe('getPlaylistById', () => {
    it('should retrieve existing playlist by ID', () => {
      // Arrange
      const created = repository.createPlaylist({ name: 'Test Playlist' });

      // Act
      const retrieved = repository.getPlaylistById(created.id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test Playlist');
    });

    it('should return null for non-existent playlist', () => {
      // Act
      const result = repository.getPlaylistById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getAllPlaylists', () => {
    it('should return empty array when no playlists exist', () => {
      // Act
      const playlists = repository.getAllPlaylists();

      // Assert
      expect(playlists).toEqual([]);
    });

    it('should return all playlists ordered by updated_at DESC', () => {
      // Arrange
      const playlist1 = repository.createPlaylist({ name: 'Playlist 1' });
      // Wait 1ms to ensure different timestamps
      const playlist2 = repository.createPlaylist({ name: 'Playlist 2' });

      // Act
      const playlists = repository.getAllPlaylists();

      // Assert
      expect(playlists).toHaveLength(2);
      // Most recently updated should be first
      expect(playlists[0].name).toBe('Playlist 2');
      expect(playlists[1].name).toBe('Playlist 1');
    });
  });

  describe('updatePlaylist', () => {
    it('should update playlist name and updated_at', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Original Name' });
      const originalUpdatedAt = playlist.updated_at;

      // Act
      const updates: UpdatePlaylistParams = { name: 'Updated Name' };
      const updated = repository.updatePlaylist(playlist.id, updates);

      // Assert
      expect(updated.name).toBe('Updated Name');
      expect(updated.updated_at).toBeGreaterThan(originalUpdatedAt);
    });

    it('should update playlist description', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });

      // Act
      const updated = repository.updatePlaylist(playlist.id, {
        description: 'New description',
      });

      // Assert
      expect(updated.description).toBe('New description');
    });

    it('should throw error when updating non-existent playlist', () => {
      // Act & Assert
      expect(() => {
        repository.updatePlaylist('non-existent-id', { name: 'New Name' });
      }).toThrow();
    });
  });

  describe('deletePlaylist', () => {
    it('should delete playlist and its entries (cascade)', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'To Delete' });
      const entry: CreatePlaylistEntryParams = {
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/path',
        source_type: 'folder',
        label: 'Test',
      };
      repository.addEntry(entry);

      // Act
      repository.deletePlaylist(playlist.id);

      // Assert
      expect(repository.getPlaylistById(playlist.id)).toBeNull();
      expect(repository.getEntries(playlist.id)).toEqual([]);
    });

    it('should not throw when deleting non-existent playlist', () => {
      // Act & Assert
      expect(() => {
        repository.deletePlaylist('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('addEntry', () => {
    it('should add entry to playlist', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      const entry: CreatePlaylistEntryParams = {
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/archive.zip',
        source_type: 'archive',
        label: 'My Archive',
        thumbnail_path: '/test/thumb.jpg',
      };

      // Act
      const added = repository.addEntry(entry);

      // Assert
      expect(added).toBeDefined();
      expect(added.playlist_id).toBe(playlist.id);
      expect(added.position).toBe(0);
      expect(added.source_path).toBe('/test/archive.zip');
      expect(added.source_type).toBe('archive');
      expect(added.label).toBe('My Archive');
      expect(added.thumbnail_path).toBe('/test/thumb.jpg');
    });

    it('should add multiple entries with different positions', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      const entry1: CreatePlaylistEntryParams = {
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      };
      const entry2: CreatePlaylistEntryParams = {
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'archive',
        label: 'Entry 2',
      };

      // Act
      repository.addEntry(entry1);
      repository.addEntry(entry2);
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(2);
      expect(entries[0].position).toBe(0);
      expect(entries[1].position).toBe(1);
    });

    it('should throw error when adding duplicate position', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      const entry1: CreatePlaylistEntryParams = {
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      };
      repository.addEntry(entry1);

      // Act & Assert
      const entry2: CreatePlaylistEntryParams = {
        playlist_id: playlist.id,
        position: 0, // Same position
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Entry 2',
      };
      expect(() => repository.addEntry(entry2)).toThrow();
    });
  });

  describe('getEntries', () => {
    it('should return empty array for playlist with no entries', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Empty' });

      // Act
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toEqual([]);
    });

    it('should return entries ordered by position', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 2,
        source_path: '/test/3',
        source_type: 'folder',
        label: 'Third',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'First',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Second',
      });

      // Act
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(3);
      expect(entries[0].label).toBe('First');
      expect(entries[1].label).toBe('Second');
      expect(entries[2].label).toBe('Third');
    });
  });

  describe('getPlaylistWithEntries', () => {
    it('should return playlist with all its entries', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Complete' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'archive',
        label: 'Entry 2',
      });

      // Act
      const result = repository.getPlaylistWithEntries(playlist.id);

      // Assert
      expect(result).toBeDefined();
      expect(result!.playlist.id).toBe(playlist.id);
      expect(result!.entries).toHaveLength(2);
    });

    it('should return null for non-existent playlist', () => {
      // Act
      const result = repository.getPlaylistWithEntries('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('removeEntry', () => {
    it('should remove entry and renumber subsequent positions', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Entry 2',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 2,
        source_path: '/test/3',
        source_type: 'folder',
        label: 'Entry 3',
      });

      // Act: Remove middle entry
      repository.removeEntry(playlist.id, 1);
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(2);
      expect(entries[0].position).toBe(0);
      expect(entries[0].label).toBe('Entry 1');
      expect(entries[1].position).toBe(1); // Renumbered from 2 to 1
      expect(entries[1].label).toBe('Entry 3');
    });

    it('should not throw when removing non-existent entry', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });

      // Act & Assert
      expect(() => {
        repository.removeEntry(playlist.id, 999);
      }).not.toThrow();
    });
  });

  describe('reorderEntries', () => {
    it('should move entry from lower to higher position', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Entry 2',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 2,
        source_path: '/test/3',
        source_type: 'folder',
        label: 'Entry 3',
      });

      // Act: Move first entry to last position (0 → 2)
      const reordered = repository.reorderEntries(playlist.id, 0, 2);

      // Assert
      expect(reordered).toHaveLength(3);
      expect(reordered[0].label).toBe('Entry 2');
      expect(reordered[0].position).toBe(0);
      expect(reordered[1].label).toBe('Entry 3');
      expect(reordered[1].position).toBe(1);
      expect(reordered[2].label).toBe('Entry 1');
      expect(reordered[2].position).toBe(2);
    });

    it('should move entry from higher to lower position', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Entry 2',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 2,
        source_path: '/test/3',
        source_type: 'folder',
        label: 'Entry 3',
      });

      // Act: Move last entry to first position (2 → 0)
      const reordered = repository.reorderEntries(playlist.id, 2, 0);

      // Assert
      expect(reordered).toHaveLength(3);
      expect(reordered[0].label).toBe('Entry 3');
      expect(reordered[0].position).toBe(0);
      expect(reordered[1].label).toBe('Entry 1');
      expect(reordered[1].position).toBe(1);
      expect(reordered[2].label).toBe('Entry 2');
      expect(reordered[2].position).toBe(2);
    });

    it('should handle reordering to same position', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Entry 2',
      });

      // Act: Move to same position
      const reordered = repository.reorderEntries(playlist.id, 1, 1);

      // Assert
      expect(reordered[0].label).toBe('Entry 1');
      expect(reordered[1].label).toBe('Entry 2');
    });
  });

  describe('updateEntry', () => {
    it('should update entry label', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Original Label',
      });

      // Act
      const updates: UpdatePlaylistEntryParams = { label: 'Updated Label' };
      const updated = repository.updateEntry(playlist.id, 0, updates);

      // Assert
      expect(updated.label).toBe('Updated Label');
    });

    it('should update entry thumbnail_path', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Test',
      });

      // Act
      const updated = repository.updateEntry(playlist.id, 0, {
        thumbnail_path: '/new/thumb.jpg',
      });

      // Assert
      expect(updated.thumbnail_path).toBe('/new/thumb.jpg');
    });

    it('should throw error when updating non-existent entry', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });

      // Act & Assert
      expect(() => {
        repository.updateEntry(playlist.id, 0, { label: 'New' });
      }).toThrow();
    });
  });

  describe('addEntriesBatch', () => {
    it('should add multiple entries at specified position', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 1,
        source_path: '/test/2',
        source_type: 'folder',
        label: 'Entry 2',
      });

      const newEntries: CreatePlaylistEntryParams[] = [
        {
          playlist_id: playlist.id,
          position: 1, // Will be adjusted
          source_path: '/test/new1',
          source_type: 'archive',
          label: 'New Entry 1',
        },
        {
          playlist_id: playlist.id,
          position: 2, // Will be adjusted
          source_path: '/test/new2',
          source_type: 'archive',
          label: 'New Entry 2',
        },
      ];

      // Act: Insert at position 1
      const added = repository.addEntriesBatch(newEntries, 1);
      const allEntries = repository.getEntries(playlist.id);

      // Assert
      expect(added).toHaveLength(2);
      expect(allEntries).toHaveLength(4);
      expect(allEntries[0].label).toBe('Entry 1');
      expect(allEntries[1].label).toBe('New Entry 1');
      expect(allEntries[2].label).toBe('New Entry 2');
      expect(allEntries[3].label).toBe('Entry 2');
    });

    it('should append entries when insertPosition not specified', () => {
      // Arrange
      const playlist = repository.createPlaylist({ name: 'Test' });
      repository.addEntry({
        playlist_id: playlist.id,
        position: 0,
        source_path: '/test/1',
        source_type: 'folder',
        label: 'Entry 1',
      });

      const newEntries: CreatePlaylistEntryParams[] = [
        {
          playlist_id: playlist.id,
          position: 1,
          source_path: '/test/new1',
          source_type: 'archive',
          label: 'New Entry 1',
        },
      ];

      // Act
      repository.addEntriesBatch(newEntries);
      const allEntries = repository.getEntries(playlist.id);

      // Assert
      expect(allEntries[allEntries.length - 1].label).toBe('New Entry 1');
    });
  });
});
