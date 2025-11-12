export interface Bookmark {
  // Identification
  id: string; // UUID

  // Reference
  archivePath: string; // Absolute path to archive file
  imageId?: string; // Optional: image ID (may be unavailable if archive moved)
  pageIndex: number; // Fallback: page number (0-based)

  // Metadata
  note: string; // User-provided note (max 500 chars)
  thumbnailPath?: string; // Path to bookmark thumbnail (copied from image thumbnail)

  // Timestamps
  createdAt: number; // Unix timestamp
  updatedAt: number; // Last modified
}
