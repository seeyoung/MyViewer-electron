export enum ArchiveFormat {
  ZIP = 'zip',
  RAR = 'rar',
  SEVEN_ZIP = '7z',
  TAR = 'tar',
  CBZ = 'cbz', // Comic Book ZIP
  CBR = 'cbr', // Comic Book RAR
}

export interface Archive {
  // Identification
  id: string; // UUID generated on open
  filePath: string; // Absolute path to archive file
  fileName: string; // Base filename (e.g., "comic.cbz")

  // Archive metadata
  format: ArchiveFormat; // ZIP | RAR | 7Z | TAR | CBZ | CBR
  fileSize: number; // Size in bytes
  isPasswordProtected: boolean; // Detected from archive headers

  // Content metadata
  totalImageCount: number; // Number of images found
  totalFileCount: number; // All files (including non-images)
  rootFolder: import('./FolderNode').FolderNode; // Root of folder hierarchy

  // State
  isOpen: boolean; // Currently open
  lastError?: string; // Last error message if failed to open

  // Timestamps
  openedAt: number; // Unix timestamp when opened
  lastAccessedAt: number; // Last interaction timestamp
}
