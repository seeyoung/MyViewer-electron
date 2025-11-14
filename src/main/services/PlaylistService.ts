import { PlaylistRepository } from '../repositories/PlaylistRepository';
import {
  Playlist,
  PlaylistEntry,
  PlaylistWithEntries,
  UpdatePlaylistParams,
  CreatePlaylistEntryParams,
} from '@shared/types/playlist';
import path from 'path';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';

/**
 * Playlist Service
 * Business logic for playlist management with security validation
 */
export class PlaylistService {
  private repository: PlaylistRepository;

  constructor(repository: PlaylistRepository) {
    this.repository = repository;
  }

  /**
   * Create a new playlist
   */
  createPlaylist(name: string, description?: string): Playlist {
    return this.repository.createPlaylist({ name, description });
  }

  /**
   * Get all playlists ordered by updated_at DESC
   */
  getAllPlaylists(): Playlist[] {
    return this.repository.getAllPlaylists();
  }

  /**
   * Get playlist with all its entries
   */
  getPlaylistWithEntries(playlistId: string): PlaylistWithEntries | null {
    return this.repository.getPlaylistWithEntries(playlistId);
  }

  /**
   * Update playlist metadata
   */
  updatePlaylist(playlistId: string, updates: UpdatePlaylistParams): Playlist {
    return this.repository.updatePlaylist(playlistId, updates);
  }

  /**
   * Delete playlist and all its entries
   */
  deletePlaylist(playlistId: string): void {
    this.repository.deletePlaylist(playlistId);
  }

  /**
   * Add a source (folder or archive) to playlist with security validation
   * @param playlistId - Target playlist ID
   * @param sourcePath - Absolute path to folder or archive
   * @param position - Optional position to insert (defaults to end)
   * @param customLabel - Optional custom label (defaults to basename)
   * @returns Created playlist entry
   */
  async addSourceToPlaylist(
    playlistId: string,
    sourcePath: string,
    position?: number,
    customLabel?: string,
    allowDuplicate = false
  ): Promise<PlaylistEntry> {
    // 1. Security validation
    const sanitizedPath = await this.validateAndSanitizePath(sourcePath);

    // 2. Check for duplicates
    const existingEntries = this.repository.getEntries(playlistId);
    const isDuplicate = existingEntries.some(entry => entry.source_path === sanitizedPath);

    if (isDuplicate && !allowDuplicate) {
      throw new Error('DUPLICATE_PATH');
    }

    // 3. Determine source type (folder or archive)
    const sourceType = await this.determineSourceType(sanitizedPath);

    // 4. Generate label
    const label = customLabel || path.basename(sanitizedPath);

    // 5. Determine position
    const targetPosition = position !== undefined ? position : existingEntries.length;

    // 5. Create entry
    const entry: CreatePlaylistEntryParams = {
      playlist_id: playlistId,
      position: targetPosition,
      source_path: sanitizedPath,
      source_type: sourceType,
      label,
    };

    // 6. Handle position shift if inserting in middle
    if (position !== undefined && position < existingEntries.length) {
      // Use batch add to handle position shifting
      return this.repository.addEntriesBatch([entry], position)[0];
    } else {
      return this.repository.addEntry(entry);
    }
  }

  /**
   * Add multiple sources to playlist in batch
   * Skips invalid paths and duplicates, continues with valid ones
   * @returns Object with added entries and skip information
   */
  async addMultipleSources(
    playlistId: string,
    sourcePaths: string[],
    insertPosition?: number
  ): Promise<{
    entries: PlaylistEntry[];
    skipped: { invalid: string[]; duplicate: string[] };
  }> {
    const validEntries: CreatePlaylistEntryParams[] = [];
    const skippedInvalid: string[] = [];
    const skippedDuplicate: string[] = [];

    // Get existing entries once
    const existingEntries = this.repository.getEntries(playlistId);
    const existingPaths = new Set(existingEntries.map(e => e.source_path));

    for (const sourcePath of sourcePaths) {
      try {
        // Validate and sanitize
        const sanitizedPath = await this.validateAndSanitizePath(sourcePath);

        // Check for duplicates
        if (existingPaths.has(sanitizedPath)) {
          skippedDuplicate.push(sourcePath);
          continue;
        }

        const sourceType = await this.determineSourceType(sanitizedPath);
        const label = path.basename(sanitizedPath);

        validEntries.push({
          playlist_id: playlistId,
          position: 0, // Will be adjusted by repository
          source_path: sanitizedPath,
          source_type: sourceType,
          label,
        });

        // Add to existing paths to catch duplicates within this batch
        existingPaths.add(sanitizedPath);
      } catch (error) {
        // Skip invalid paths, continue with others
        console.warn(`Skipping invalid path: ${sourcePath}`, error);
        skippedInvalid.push(sourcePath);
      }
    }

    const entries =
      validEntries.length === 0 ? [] : this.repository.addEntriesBatch(validEntries, insertPosition);

    return {
      entries,
      skipped: {
        invalid: skippedInvalid,
        duplicate: skippedDuplicate,
      },
    };
  }

  /**
   * Validate that an entry's path still exists and is accessible
   */
  async validateEntry(entry: PlaylistEntry): Promise<boolean> {
    try {
      // Check if path exists
      await fs.access(entry.source_path, fsConstants.F_OK);

      // Check if readable
      await fs.access(entry.source_path, fsConstants.R_OK);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove invalid entries (non-existent or inaccessible paths)
   * Returns the number of entries removed
   */
  async cleanupInvalidEntries(playlistId: string): Promise<number> {
    const entries = this.repository.getEntries(playlistId);
    let removedCount = 0;

    // Validate each entry (in reverse to avoid position shift issues)
    for (let i = entries.length - 1; i >= 0; i--) {
      const isValid = await this.validateEntry(entries[i]);
      if (!isValid) {
        this.repository.removeEntry(playlistId, entries[i].position);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Remove entry from playlist
   */
  removeEntry(playlistId: string, position: number): void {
    this.repository.removeEntry(playlistId, position);
  }

  /**
   * Reorder entries in playlist
   */
  reorderEntries(
    playlistId: string,
    fromPosition: number,
    toPosition: number
  ): PlaylistEntry[] {
    return this.repository.reorderEntries(playlistId, fromPosition, toPosition);
  }

  /**
   * Update entry metadata (label, thumbnail)
   */
  updateEntry(
    playlistId: string,
    position: number,
    updates: { label?: string; thumbnail_path?: string }
  ): PlaylistEntry {
    return this.repository.updateEntry(playlistId, position, updates);
  }

  /**
   * Validate and sanitize a file system path (SECURITY CRITICAL)
   * @param inputPath - User-provided path
   * @returns Sanitized absolute path
   * @throws Error if path is invalid or insecure
   */
  private async validateAndSanitizePath(inputPath: string): Promise<string> {
    // 1. Check for null bytes (can bypass security checks)
    if (inputPath.includes('\0')) {
      throw new Error('Invalid character (null byte) in path');
    }

    // 2. Normalize path (resolve .., ., redundant slashes)
    let normalized = path.normalize(inputPath);

    // Remove trailing slashes (except for root)
    if (normalized.length > 1 && (normalized.endsWith('/') || normalized.endsWith('\\'))) {
      normalized = normalized.slice(0, -1);
    }

    // 3. Check if absolute path (REQUIRED for playlist sources)
    if (!path.isAbsolute(normalized)) {
      throw new Error('Absolute path required for playlist sources');
    }

    // 4. Check for path traversal after normalization
    const segments = normalized.split(path.sep).filter(Boolean);
    if (segments.includes('..')) {
      throw new Error('Path traversal detected (.. in path)');
    }

    // 5. Check if path exists
    try {
      await fs.access(normalized, fsConstants.F_OK);
    } catch (error) {
      throw new Error(`Path does not exist: ${normalized}`);
    }

    // 6. Check if readable
    try {
      await fs.access(normalized, fsConstants.R_OK);
    } catch (error) {
      throw new Error(`Path is not readable (permission denied): ${normalized}`);
    }

    return normalized;
  }

  /**
   * Determine if path is a folder or archive file
   */
  private async determineSourceType(
    filePath: string
  ): Promise<'folder' | 'archive'> {
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      return 'folder';
    }

    // Check file extension for archive formats
    const ext = path.extname(filePath).toLowerCase();
    const archiveExtensions = ['.zip', '.cbz', '.rar', '.cbr', '.7z', '.tar'];

    if (archiveExtensions.includes(ext)) {
      return 'archive';
    }

    // Default to archive if it's a file
    return 'archive';
  }
}
