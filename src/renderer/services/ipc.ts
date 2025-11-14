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
}

// Singleton instance
const ipcClient = new IpcClient();

export default ipcClient;
