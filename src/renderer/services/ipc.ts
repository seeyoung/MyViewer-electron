/**
 * IPC Client Wrapper
 * Typed interface for invoking IPC methods from renderer process
 */

import { ScanProgressEvent, ScanCompleteEvent } from '@shared/types/Scan';
import * as channels from '@shared/constants/ipc-channels';

class IpcClient {
  private electronAPI = window.electronAPI;

  /**
   * Invoke an IPC method
   */
  public async invoke<T = unknown>(channel: string, data?: unknown): Promise<T> {
    try {
      const result = await this.electronAPI.invoke(channel, data);
      return result as T;
    } catch (error) {
      console.error(`IPC invoke error on channel "${channel}":`, error);
      throw error;
    }
  }

  /**
   * Send a one-way message (no response expected)
   */
  public send(channel: string, data?: unknown): void {
    this.electronAPI.send(channel, data);
  }

  /**
   * Listen to IPC events
   */
  public on(channel: string, callback: (...args: unknown[]) => void): () => void {
    return this.electronAPI.on(channel, callback);
  }

  /**
   * Remove all listeners for a channel
   */
  public removeAllListeners(channel: string): void {
    this.electronAPI.removeAllListeners(channel);
  }

  /**
   * Cancel an active folder scan
   */
  public async cancelFolderScan(scanToken: string): Promise<{ success: boolean }> {
    return this.invoke(channels.FOLDER_SCAN_CANCEL, { scanToken });
  }

  /**
   * Cancel an active archive scan
   */
  public async cancelArchiveScan(scanToken: string): Promise<{ success: boolean }> {
    return this.invoke(channels.ARCHIVE_SCAN_CANCEL, { scanToken });
  }

  /**
   * Cancel an active scan (folder or archive)
   */
  public async cancelScan(scanToken: string, isArchive: boolean = false): Promise<{ success: boolean }> {
    return isArchive ? this.cancelArchiveScan(scanToken) : this.cancelFolderScan(scanToken);
  }

  /**
   * Listen to folder scan progress events
   */
  public onFolderScanProgress(callback: (event: ScanProgressEvent) => void): () => void {
    return this.on(channels.FOLDER_SCAN_PROGRESS, callback);
  }

  /**
   * Listen to folder scan complete events
   */
  public onFolderScanComplete(callback: (event: ScanCompleteEvent) => void): () => void {
    return this.on(channels.FOLDER_SCAN_COMPLETE, callback);
  }

  /**
   * Listen to archive scan progress events
   */
  public onArchiveScanProgress(callback: (event: ScanProgressEvent) => void): () => void {
    return this.on(channels.ARCHIVE_SCAN_PROGRESS, callback);
  }

  /**
   * Listen to archive scan complete events
   */
  public onArchiveScanComplete(callback: (event: ScanCompleteEvent) => void): () => void {
    return this.on(channels.ARCHIVE_SCAN_COMPLETE, callback);
  }

  /**
   * Listen to scan progress events (folder or archive)
   * @deprecated Use onFolderScanProgress or onArchiveScanProgress
   */
  public onScanProgress(callback: (event: ScanProgressEvent) => void): () => void {
    return this.onFolderScanProgress(callback);
  }

  /**
   * Listen to scan complete events (folder or archive)
   * @deprecated Use onFolderScanComplete or onArchiveScanComplete
   */
  public onScanComplete(callback: (event: ScanCompleteEvent) => void): () => void {
    return this.onFolderScanComplete(callback);
  }

  // Playlist operations
  /**
   * Create a new playlist
   */
  public async createPlaylist(name: string, description?: string): Promise<any> {
    return this.invoke(channels.PLAYLIST_CREATE, { name, description });
  }

  /**
   * Update playlist metadata
   */
  public async updatePlaylist(
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<any> {
    return this.invoke(channels.PLAYLIST_UPDATE, { id, ...updates });
  }

  /**
   * Delete a playlist
   */
  public async deletePlaylist(id: string): Promise<{ success: boolean }> {
    return this.invoke(channels.PLAYLIST_DELETE, { id });
  }

  /**
   * Get all playlists
   */
  public async getAllPlaylists(): Promise<any[]> {
    return this.invoke(channels.PLAYLIST_GET_ALL);
  }

  /**
   * Get playlist with all entries
   */
  public async getPlaylistById(id: string): Promise<any | null> {
    return this.invoke(channels.PLAYLIST_GET_BY_ID, { id });
  }

  /**
   * Add a source to playlist
   */
  public async addPlaylistEntry(
    playlistId: string,
    sourcePath: string,
    position?: number,
    customLabel?: string
  ): Promise<any> {
    return this.invoke(channels.PLAYLIST_ADD_ENTRY, {
      playlistId,
      sourcePath,
      position,
      customLabel,
    });
  }

  /**
   * Add multiple sources to playlist
   */
  public async addPlaylistEntriesBatch(
    playlistId: string,
    sourcePaths: string[],
    insertPosition?: number
  ): Promise<any[]> {
    return this.invoke(channels.PLAYLIST_ADD_ENTRIES_BATCH, {
      playlistId,
      sourcePaths,
      insertPosition,
    });
  }

  /**
   * Remove entry from playlist
   */
  public async removePlaylistEntry(playlistId: string, position: number): Promise<{ success: boolean }> {
    return this.invoke(channels.PLAYLIST_REMOVE_ENTRY, { playlistId, position });
  }

  /**
   * Reorder entries in playlist
   */
  public async reorderPlaylistEntries(
    playlistId: string,
    fromPosition: number,
    toPosition: number
  ): Promise<any[]> {
    return this.invoke(channels.PLAYLIST_REORDER_ENTRIES, {
      playlistId,
      fromPosition,
      toPosition,
    });
  }

  /**
   * Update entry metadata
   */
  public async updatePlaylistEntry(
    playlistId: string,
    position: number,
    updates: { label?: string; thumbnail_path?: string }
  ): Promise<any> {
    return this.invoke(channels.PLAYLIST_UPDATE_ENTRY, {
      playlistId,
      position,
      updates,
    });
  }

  /**
   * Clean up invalid entries (non-existent paths)
   */
  public async cleanupInvalidPlaylistEntries(playlistId: string): Promise<{ removedCount: number }> {
    return this.invoke(channels.PLAYLIST_CLEANUP_INVALID, { playlistId });
  }
}

// Singleton instance
const ipcClient = new IpcClient();

export default ipcClient;
