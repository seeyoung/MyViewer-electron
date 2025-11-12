export enum ThumbnailStatus {
  PENDING = 'pending', // Queued for generation
  GENERATING = 'generating', // Currently being generated
  READY = 'ready', // Available for use
  FAILED = 'failed', // Generation failed (corrupt image, etc.)
}

export interface Thumbnail {
  // Identification
  id: string; // UUID
  imageId: string; // Source image ID

  // Cache information
  cacheKey: string; // SHA-256 hash (for filename)
  cachePath: string; // Absolute path to thumbnail file

  // Thumbnail properties
  width: number; // Thumbnail width (e.g., 200)
  height: number; // Thumbnail height (e.g., 200)
  format: 'jpeg' | 'webp'; // Thumbnail format (always compressed)
  fileSize: number; // Thumbnail file size in bytes

  // Generation
  status: ThumbnailStatus; // PENDING | GENERATING | READY | FAILED
  generatedAt?: number; // Unix timestamp
  lastAccessedAt: number; // For LRU cache eviction

  // Error handling
  error?: string; // Error message if generation failed
}

export interface ThumbnailCache {
  maxSizeBytes: number; // Default: 5GB
  maxAgeSeconds: number; // Default: 30 days

  // LRU eviction
  evictLRU(): Promise<void>; // Remove least-recently-accessed

  // Cleanup
  pruneOld(): Promise<void>; // Remove thumbnails older than maxAge
  pruneCorrupted(): Promise<void>; // Remove thumbnails with missing source
}
