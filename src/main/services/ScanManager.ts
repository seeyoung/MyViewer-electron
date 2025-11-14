/**
 * ScanManager - Manages active scan operations with cancellation support
 *
 * Tracks active scans by token and provides cancellation via AbortController.
 * Used by FolderService and ArchiveService for progressive scanning.
 */
export class ScanManager {
  private activeScans = new Map<string, AbortController>();

  /**
   * Start a new scan and register its AbortController
   * @param token Unique scan token (UUID)
   * @returns AbortController for the scan
   */
  startScan(token: string): AbortController {
    // Cancel any existing scan with this token
    this.cancelScan(token);

    const controller = new AbortController();
    this.activeScans.set(token, controller);
    return controller;
  }

  /**
   * Cancel a scan by token
   * @param token Scan token to cancel
   */
  cancelScan(token: string): void {
    const controller = this.activeScans.get(token);
    if (controller) {
      controller.abort();
      this.activeScans.delete(token);
    }
  }

  /**
   * Cancel all active scans
   */
  cancelAllScans(): void {
    for (const controller of this.activeScans.values()) {
      controller.abort();
    }
    this.activeScans.clear();
  }

  /**
   * Check if a scan is currently active
   * @param token Scan token to check
   * @returns true if scan is active
   */
  isScanning(token: string): boolean {
    return this.activeScans.has(token);
  }

  /**
   * Check if a scan has been aborted
   * @param token Scan token to check
   * @returns true if scan was aborted
   */
  isAborted(token: string): boolean {
    const controller = this.activeScans.get(token);
    return controller?.signal.aborted ?? false;
  }

  /**
   * Get the AbortSignal for a scan
   * @param token Scan token
   * @returns AbortSignal or null if scan doesn't exist
   */
  getSignal(token: string): AbortSignal | null {
    return this.activeScans.get(token)?.signal ?? null;
  }

  /**
   * Clean up a completed scan
   * @param token Scan token to clean up
   */
  completeScan(token: string): void {
    this.activeScans.delete(token);
  }
}
