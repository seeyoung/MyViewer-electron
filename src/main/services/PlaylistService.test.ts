import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Mock electron module
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test',
  },
}));

import { PlaylistService } from './PlaylistService';
import { PlaylistRepository } from '../repositories/PlaylistRepository';

describe('PlaylistService', () => {
  let service: PlaylistService;
  let repository: PlaylistRepository;
  let db: Database.Database;
  let testDir: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
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

    // Create repository and service
    repository = new PlaylistRepository(db);
    service = new PlaylistService(repository);

    // Create test directory
    testDir = path.join(tmpdir(), `myviewer-playlist-test-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createPlaylist', () => {
    it('should create playlist with name only', () => {
      // Act
      const playlist = service.createPlaylist('My Playlist');

      // Assert
      expect(playlist).toBeDefined();
      expect(playlist.id).toBeTruthy();
      expect(playlist.name).toBe('My Playlist');
      expect(playlist.description).toBeUndefined();
      expect(playlist.created_at).toBeGreaterThan(0);
    });

    it('should create playlist with name and description', () => {
      // Act
      const playlist = service.createPlaylist('My Playlist', 'Test description');

      // Assert
      expect(playlist.description).toBe('Test description');
    });

    it('should generate unique IDs for different playlists', () => {
      // Act
      const playlist1 = service.createPlaylist('Playlist 1');
      const playlist2 = service.createPlaylist('Playlist 2');

      // Assert
      expect(playlist1.id).not.toBe(playlist2.id);
    });
  });

  describe('addSourceToPlaylist - Security', () => {
    it('should accept valid absolute folder path', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folderPath = path.join(testDir, 'test-folder');
      await fs.mkdir(folderPath);

      // Act
      const entry = await service.addSourceToPlaylist(playlist.id, folderPath);

      // Assert
      expect(entry).toBeDefined();
      expect(entry.source_path).toBe(folderPath);
      expect(entry.source_type).toBe('folder');
      expect(entry.label).toBe('test-folder');
    });

    it('should accept valid absolute archive path', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const archivePath = path.join(testDir, 'test.zip');
      await fs.writeFile(archivePath, 'fake archive');

      // Act
      const entry = await service.addSourceToPlaylist(playlist.id, archivePath);

      // Assert
      expect(entry.source_type).toBe('archive');
      expect(entry.label).toBe('test.zip');
    });

    it('should reject path traversal attempts (..)', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const maliciousPath = path.join(testDir, '../../../etc/passwd');

      // Act & Assert
      await expect(
        service.addSourceToPlaylist(playlist.id, maliciousPath)
      ).rejects.toThrow(/path traversal/i);
    });

    it('should reject relative paths', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const relativePath = './test-folder';

      // Act & Assert
      await expect(
        service.addSourceToPlaylist(playlist.id, relativePath)
      ).rejects.toThrow(/absolute path required/i);
    });

    it('should reject non-existent paths', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const nonExistentPath = path.join(testDir, 'does-not-exist');

      // Act & Assert
      await expect(
        service.addSourceToPlaylist(playlist.id, nonExistentPath)
      ).rejects.toThrow(/does not exist/i);
    });

    it('should reject paths with null bytes', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const maliciousPath = '/tmp/test\0hidden';

      // Act & Assert
      await expect(
        service.addSourceToPlaylist(playlist.id, maliciousPath)
      ).rejects.toThrow(/invalid character/i);
    });

    it('should normalize paths (remove redundant slashes)', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folderPath = path.join(testDir, 'test-folder');
      await fs.mkdir(folderPath);
      const pathWithSlashes = folderPath + '///';

      // Act
      const entry = await service.addSourceToPlaylist(playlist.id, pathWithSlashes);

      // Assert
      expect(entry.source_path).toBe(folderPath); // Normalized without trailing slashes
    });
  });

  describe('addSourceToPlaylist - Label generation', () => {
    it('should use basename as default label', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folderPath = path.join(testDir, 'My Cool Folder');
      await fs.mkdir(folderPath);

      // Act
      const entry = await service.addSourceToPlaylist(playlist.id, folderPath);

      // Assert
      expect(entry.label).toBe('My Cool Folder');
    });

    it('should accept custom label', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folderPath = path.join(testDir, 'test-folder');
      await fs.mkdir(folderPath);

      // Act
      const entry = await service.addSourceToPlaylist(
        playlist.id,
        folderPath,
        undefined,
        'Custom Label'
      );

      // Assert
      expect(entry.label).toBe('Custom Label');
    });
  });

  describe('addSourceToPlaylist - Position handling', () => {
    it('should append to end when position not specified', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);

      // Act
      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(2);
      expect(entries[0].label).toBe('folder1');
      expect(entries[1].label).toBe('folder2');
    });

    it('should insert at specified position', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      const folder3 = path.join(testDir, 'folder3');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);
      await fs.mkdir(folder3);

      // Act
      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);
      await service.addSourceToPlaylist(playlist.id, folder3, 1); // Insert at position 1
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(3);
      expect(entries[0].label).toBe('folder1');
      expect(entries[1].label).toBe('folder3'); // Inserted
      expect(entries[2].label).toBe('folder2'); // Pushed down
    });
  });

  describe('addMultipleSources', () => {
    it('should add multiple sources in batch', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      const folder3 = path.join(testDir, 'folder3');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);
      await fs.mkdir(folder3);

      // Act
      const entries = await service.addMultipleSources(playlist.id, [
        folder1,
        folder2,
        folder3,
      ]);

      // Assert
      expect(entries).toHaveLength(3);
      expect(entries[0].label).toBe('folder1');
      expect(entries[1].label).toBe('folder2');
      expect(entries[2].label).toBe('folder3');
    });

    it('should insert batch at specified position', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      const newFolder1 = path.join(testDir, 'new1');
      const newFolder2 = path.join(testDir, 'new2');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);
      await fs.mkdir(newFolder1);
      await fs.mkdir(newFolder2);

      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);

      // Act: Insert at position 1
      await service.addMultipleSources(playlist.id, [newFolder1, newFolder2], 1);
      const allEntries = repository.getEntries(playlist.id);

      // Assert
      expect(allEntries).toHaveLength(4);
      expect(allEntries[0].label).toBe('folder1');
      expect(allEntries[1].label).toBe('new1'); // Inserted
      expect(allEntries[2].label).toBe('new2'); // Inserted
      expect(allEntries[3].label).toBe('folder2'); // Pushed down
    });

    it('should skip invalid paths and continue with valid ones', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const validFolder = path.join(testDir, 'valid');
      const invalidFolder = path.join(testDir, 'invalid');
      await fs.mkdir(validFolder);
      // Don't create invalidFolder

      // Act
      const entries = await service.addMultipleSources(playlist.id, [
        validFolder,
        invalidFolder,
      ]);

      // Assert
      expect(entries).toHaveLength(1); // Only valid folder added
      expect(entries[0].label).toBe('valid');
    });
  });

  describe('validateEntry', () => {
    it('should return true for valid existing path', async () => {
      // Arrange
      const folderPath = path.join(testDir, 'valid-folder');
      await fs.mkdir(folderPath);
      const entry = {
        playlist_id: 'test',
        position: 0,
        source_path: folderPath,
        source_type: 'folder' as const,
        label: 'test',
      };

      // Act
      const isValid = await service.validateEntry(entry);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      // Arrange
      const entry = {
        playlist_id: 'test',
        position: 0,
        source_path: path.join(testDir, 'does-not-exist'),
        source_type: 'folder' as const,
        label: 'test',
      };

      // Act
      const isValid = await service.validateEntry(entry);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should return false for path with no read permissions', async () => {
      // Arrange
      const restrictedPath = path.join(testDir, 'restricted');
      await fs.mkdir(restrictedPath);
      await fs.chmod(restrictedPath, 0o000); // Remove all permissions

      const entry = {
        playlist_id: 'test',
        position: 0,
        source_path: restrictedPath,
        source_type: 'folder' as const,
        label: 'test',
      };

      // Act
      const isValid = await service.validateEntry(entry);

      // Assert
      expect(isValid).toBe(false);

      // Cleanup
      await fs.chmod(restrictedPath, 0o755);
    });
  });

  describe('cleanupInvalidEntries', () => {
    it('should remove entries with non-existent paths', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const validFolder = path.join(testDir, 'valid');
      const tempFolder = path.join(testDir, 'temp');
      await fs.mkdir(validFolder);
      await fs.mkdir(tempFolder);

      await service.addSourceToPlaylist(playlist.id, validFolder);
      await service.addSourceToPlaylist(playlist.id, tempFolder);

      // Delete tempFolder to make it invalid
      await fs.rm(tempFolder, { recursive: true });

      // Act
      const removedCount = await service.cleanupInvalidEntries(playlist.id);
      const remainingEntries = repository.getEntries(playlist.id);

      // Assert
      expect(removedCount).toBe(1);
      expect(remainingEntries).toHaveLength(1);
      expect(remainingEntries[0].label).toBe('valid');
    });

    it('should return 0 when all entries are valid', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);

      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);

      // Act
      const removedCount = await service.cleanupInvalidEntries(playlist.id);

      // Assert
      expect(removedCount).toBe(0);
    });

    it('should renumber positions after cleanup', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const tempFolder = path.join(testDir, 'temp');
      const folder2 = path.join(testDir, 'folder2');
      await fs.mkdir(folder1);
      await fs.mkdir(tempFolder);
      await fs.mkdir(folder2);

      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, tempFolder);
      await service.addSourceToPlaylist(playlist.id, folder2);

      // Delete middle folder
      await fs.rm(tempFolder, { recursive: true });

      // Act
      await service.cleanupInvalidEntries(playlist.id);
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(2);
      expect(entries[0].position).toBe(0);
      expect(entries[0].label).toBe('folder1');
      expect(entries[1].position).toBe(1); // Renumbered
      expect(entries[1].label).toBe('folder2');
    });
  });

  describe('getAllPlaylists', () => {
    it('should return all playlists', () => {
      // Arrange
      service.createPlaylist('Playlist 1');
      service.createPlaylist('Playlist 2');
      service.createPlaylist('Playlist 3');

      // Act
      const playlists = service.getAllPlaylists();

      // Assert
      expect(playlists).toHaveLength(3);
    });

    it('should return playlists ordered by updated_at DESC', () => {
      // Arrange
      const p1 = service.createPlaylist('Playlist 1');
      const p2 = service.createPlaylist('Playlist 2');

      // Act
      const playlists = service.getAllPlaylists();

      // Assert
      expect(playlists[0].id).toBe(p2.id); // Most recent first
      expect(playlists[1].id).toBe(p1.id);
    });
  });

  describe('getPlaylistWithEntries', () => {
    it('should return playlist with all entries', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);

      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);

      // Act
      const result = service.getPlaylistWithEntries(playlist.id);

      // Assert
      expect(result).toBeDefined();
      expect(result!.playlist.id).toBe(playlist.id);
      expect(result!.entries).toHaveLength(2);
    });

    it('should return null for non-existent playlist', () => {
      // Act
      const result = service.getPlaylistWithEntries('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updatePlaylist', () => {
    it('should update playlist name', () => {
      // Arrange
      const playlist = service.createPlaylist('Original Name');

      // Act
      const updated = service.updatePlaylist(playlist.id, { name: 'New Name' });

      // Assert
      expect(updated.name).toBe('New Name');
      expect(updated.updated_at).toBeGreaterThan(playlist.updated_at);
    });

    it('should update playlist description', () => {
      // Arrange
      const playlist = service.createPlaylist('Test');

      // Act
      const updated = service.updatePlaylist(playlist.id, {
        description: 'New description',
      });

      // Assert
      expect(updated.description).toBe('New description');
    });
  });

  describe('deletePlaylist', () => {
    it('should delete playlist and all its entries', async () => {
      // Arrange
      const playlist = service.createPlaylist('To Delete');
      const folder = path.join(testDir, 'folder');
      await fs.mkdir(folder);
      await service.addSourceToPlaylist(playlist.id, folder);

      // Act
      service.deletePlaylist(playlist.id);

      // Assert
      expect(service.getPlaylistWithEntries(playlist.id)).toBeNull();
    });
  });

  describe('removeEntry', () => {
    it('should remove entry from playlist', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);

      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);

      // Act
      service.removeEntry(playlist.id, 0);
      const entries = repository.getEntries(playlist.id);

      // Assert
      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('folder2');
      expect(entries[0].position).toBe(0); // Renumbered
    });
  });

  describe('reorderEntries', () => {
    it('should reorder entries', async () => {
      // Arrange
      const playlist = service.createPlaylist('Test');
      const folder1 = path.join(testDir, 'folder1');
      const folder2 = path.join(testDir, 'folder2');
      const folder3 = path.join(testDir, 'folder3');
      await fs.mkdir(folder1);
      await fs.mkdir(folder2);
      await fs.mkdir(folder3);

      await service.addSourceToPlaylist(playlist.id, folder1);
      await service.addSourceToPlaylist(playlist.id, folder2);
      await service.addSourceToPlaylist(playlist.id, folder3);

      // Act: Move first to last (0 → 2)
      const reordered = service.reorderEntries(playlist.id, 0, 2);

      // Assert
      expect(reordered[0].label).toBe('folder2');
      expect(reordered[1].label).toBe('folder3');
      expect(reordered[2].label).toBe('folder1');
    });
  });
});
