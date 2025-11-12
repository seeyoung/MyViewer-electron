/**
 * Archive Reader Interface
 * Common interface for all archive format readers
 */

export interface ArchiveEntry {
  path: string; // Path within archive
  isDirectory: boolean;
  size: number; // Uncompressed size
  compressedSize: number; // Compressed size
}

export interface ArchiveReader {
  /**
   * Open an archive file
   */
  open(filePath: string, password?: string): Promise<void>;

  /**
   * Close the archive
   */
  close(): Promise<void>;

  /**
   * List all entries in the archive
   */
  listEntries(): Promise<ArchiveEntry[]>;

  /**
   * Extract a single entry from the archive
   * Returns buffer containing file data
   */
  extractEntry(entryPath: string): Promise<Buffer>;

  /**
   * Check if archive is password protected
   */
  isPasswordProtected(): Promise<boolean>;
}
