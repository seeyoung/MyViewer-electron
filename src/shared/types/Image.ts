export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  GIF = 'gif',
  BMP = 'bmp',
  TIFF = 'tiff',
  WEBP = 'webp',
  PSD = 'psd',
  SVG = 'svg',
  UNKNOWN = 'unknown',
}

export interface ImageDimensions {
  width: number; // pixels
  height: number; // pixels
}

export interface Image {
  // Identification
  id: string; // UUID
  archiveId: string; // Parent archive ID

  // Path information
  pathInArchive: string; // Full path within archive (e.g., "folder/image.jpg")
  fileName: string; // Base filename (e.g., "image.jpg")
  folderPath: string; // Parent folder path (e.g., "folder/")

  // Image metadata
  format: ImageFormat; // JPEG | PNG | GIF | ...
  fileSize: number; // Compressed size in archive
  dimensions?: ImageDimensions; // Width/height (lazy loaded)

  // Position
  globalIndex: number; // Position in flat sorted list (0-based)
  folderIndex: number; // Position within parent folder (0-based)

  // State
  isLoaded: boolean; // Buffer currently in memory
  isCorrupted: boolean; // Failed to decode

  // References
  thumbnailPath?: string; // Path to cached thumbnail file
}
