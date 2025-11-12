# Data Model

**Feature**: Archive-Based Image Viewer
**Date**: 2025-10-28
**Phase**: 1 - Design & Contracts

## Overview

This document defines the data structures and relationships for the archive image viewer application. The model supports reading from multiple archive formats, managing viewing sessions, bookmarks, and caching thumbnails.

## Entity Relationship Diagram

```
┌─────────────────┐
│    Archive      │
└────────┬────────┘
         │ 1
         │
         │ *
┌────────▼────────┐         ┌──────────────────┐
│  FolderNode     │◄────┐   │ ViewingSession   │
└────────┬────────┘     │   └────────┬─────────┘
         │ *            │            │ 1
         │              │            │
         │ *            │            │ 1
┌────────▼────────┐     │   ┌────────▼─────────┐
│     Image       │─────┘   │    Bookmark      │
└────────┬────────┘         └──────────────────┘
         │ 1
         │
         │ 0..1
┌────────▼────────┐
│   Thumbnail     │
└─────────────────┘
```

## Core Entities

### Archive

Represents a compressed archive file containing images and folders.

**TypeScript Interface**:
```typescript
interface Archive {
  // Identification
  id: string                    // UUID generated on open
  filePath: string              // Absolute path to archive file
  fileName: string              // Base filename (e.g., "comic.cbz")

  // Archive metadata
  format: ArchiveFormat         // ZIP | RAR | 7Z | TAR | CBZ | CBR
  fileSize: number              // Size in bytes
  isPasswordProtected: boolean  // Detected from archive headers

  // Content metadata
  totalImageCount: number       // Number of images found
  totalFileCount: number        // All files (including non-images)
  rootFolder: FolderNode        // Root of folder hierarchy

  // State
  isOpen: boolean               // Currently open
  lastError?: string            // Last error message if failed to open

  // Timestamps
  openedAt: number              // Unix timestamp when opened
  lastAccessedAt: number        // Last interaction timestamp
}

enum ArchiveFormat {
  ZIP = 'zip',
  RAR = 'rar',
  SEVEN_ZIP = '7z',
  TAR = 'tar',
  CBZ = 'cbz',    // Comic Book ZIP
  CBR = 'cbr'     // Comic Book RAR
}
```

**Validation Rules**:
- `filePath` must exist and be readable
- `format` must be one of supported types (detected from file extension + magic bytes)
- `totalImageCount` must be > 0 (archives with no images should error)
- `isPasswordProtected` detected during open; if true, requires password to access content

**Lifecycle**:
1. Created when user opens archive file (File > Open, drag-and-drop, CLI argument)
2. Populated during archive scan (list entries, build folder tree)
3. Kept in memory while archive is active
4. Closed when user closes archive or opens different one (if single-tab mode)

---

### Image

Represents an individual image file within an archive.

**TypeScript Interface**:
```typescript
interface Image {
  // Identification
  id: string                    // UUID
  archiveId: string             // Parent archive ID

  // Path information
  pathInArchive: string         // Full path within archive (e.g., "folder/image.jpg")
  fileName: string              // Base filename (e.g., "image.jpg")
  folderPath: string            // Parent folder path (e.g., "folder/")

  // Image metadata
  format: ImageFormat           // JPEG | PNG | GIF | ...
  fileSize: number              // Compressed size in archive
  dimensions?: ImageDimensions  // Width/height (lazy loaded)

  // Position
  globalIndex: number           // Position in flat sorted list (0-based)
  folderIndex: number           // Position within parent folder (0-based)

  // State
  isLoaded: boolean             // Buffer currently in memory
  isCorrupted: boolean          // Failed to decode

  // References
  thumbnailPath?: string        // Path to cached thumbnail file
}

enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  GIF = 'gif',
  BMP = 'bmp',
  TIFF = 'tiff',
  WEBP = 'webp',
  PSD = 'psd',
  UNKNOWN = 'unknown'
}

interface ImageDimensions {
  width: number   // pixels
  height: number  // pixels
}
```

**Validation Rules**:
- `pathInArchive` must not contain `..` or start with `/` (security: prevent path traversal)
- `format` detected from file extension + magic bytes (first 16 bytes of file)
- `globalIndex` must be unique within archive
- `folderIndex` must be unique within parent folder

**Sorting**:
- Images sorted by `pathInArchive` using natural sort (file1.jpg, file2.jpg, file10.jpg, file20.jpg)
- Natural sort handles numbers correctly (file10 comes after file2, not between file1 and file2)

---

### FolderNode

Represents a folder within an archive's directory structure.

**TypeScript Interface**:
```typescript
interface FolderNode {
  // Identification
  id: string                    // UUID
  archiveId: string             // Parent archive ID

  // Hierarchy
  path: string                  // Full path (e.g., "comics/marvel/")
  name: string                  // Folder name (e.g., "marvel")
  parentId?: string             // Parent folder ID (undefined for root)

  // Contents
  childFolders: FolderNode[]    // Subfolders
  images: Image[]               // Images directly in this folder

  // Counts (for display)
  totalImageCount: number       // Images in this folder + all subfolders
  directImageCount: number      // Images only in this folder

  // UI state
  isExpanded: boolean           // Folder tree expanded/collapsed
}
```

**Validation Rules**:
- Root folder has `path` = "/" and `name` = "" (or archive filename)
- `path` must be unique within archive
- `childFolders` and `images` sorted alphabetically (natural sort)
- `totalImageCount` ≥ `directImageCount`

**Tree Building**:
```typescript
// Example: Archive contains these image paths
// images/page01.jpg
// images/chapter1/page01.jpg
// images/chapter1/page02.jpg

// Becomes this tree:
{
  path: "/",
  childFolders: [
    {
      path: "/images/",
      name: "images",
      images: [{ fileName: "page01.jpg" }],
      childFolders: [
        {
          path: "/images/chapter1/",
          name: "chapter1",
          images: [
            { fileName: "page01.jpg" },
            { fileName: "page02.jpg" }
          ]
        }
      ]
    }
  ]
}
```

---

### Thumbnail

Represents a generated preview image for quick browsing.

**TypeScript Interface**:
```typescript
interface Thumbnail {
  // Identification
  id: string                    // UUID
  imageId: string               // Source image ID

  // Cache information
  cacheKey: string              // SHA-256 hash (for filename)
  cachePath: string             // Absolute path to thumbnail file

  // Thumbnail properties
  width: number                 // Thumbnail width (e.g., 200)
  height: number                // Thumbnail height (e.g., 200)
  format: 'jpeg' | 'webp'       // Thumbnail format (always compressed)
  fileSize: number              // Thumbnail file size in bytes

  // Generation
  status: ThumbnailStatus       // PENDING | GENERATING | READY | FAILED
  generatedAt?: number          // Unix timestamp
  lastAccessedAt: number        // For LRU cache eviction

  // Error handling
  error?: string                // Error message if generation failed
}

enum ThumbnailStatus {
  PENDING = 'pending',          // Queued for generation
  GENERATING = 'generating',    // Currently being generated
  READY = 'ready',              // Available for use
  FAILED = 'failed'             // Generation failed (corrupt image, etc.)
}
```

**Validation Rules**:
- `cacheKey` format: `sha256(archivePath + ':' + imagePathInArchive + ':' + size)`
- `cachePath` must be within thumbnail cache directory
- `width` and `height` maintain source aspect ratio (one dimension may be smaller than target)
- `status` must progress: PENDING → GENERATING → (READY | FAILED)

**Cache Management**:
```typescript
interface ThumbnailCache {
  maxSizeBytes: number          // Default: 5GB
  maxAgeSeconds: number         // Default: 30 days

  // LRU eviction
  evictLRU(): Promise<void>     // Remove least-recently-accessed

  // Cleanup
  pruneOld(): Promise<void>     // Remove thumbnails older than maxAge
  pruneCorrupted(): Promise<void> // Remove thumbnails with missing source
}
```

---

### Bookmark

Represents a user-saved reference to a specific page.

**TypeScript Interface**:
```typescript
interface Bookmark {
  // Identification
  id: string                    // UUID

  // Reference
  archivePath: string           // Absolute path to archive file
  imageId?: string              // Optional: image ID (may be unavailable if archive moved)
  pageIndex: number             // Fallback: page number (0-based)

  // Metadata
  note: string                  // User-provided note (max 500 chars)
  thumbnailPath?: string        // Path to bookmark thumbnail (copied from image thumbnail)

  // Timestamps
  createdAt: number             // Unix timestamp
  updatedAt: number             // Last modified
}
```

**Validation Rules**:
- `archivePath` + `pageIndex` must be unique (one bookmark per page per archive)
- `note` max length: 500 characters
- `pageIndex` ≥ 0
- If `imageId` is set, it should reference a valid image when archive is open

**Persistence**:
- Stored in SQLite database (survives app restarts)
- Thumbnails copied to persistent storage (survive thumbnail cache eviction)
- Archives can be moved/renamed; `pageIndex` provides fallback if `imageId` lookup fails

**Database Schema**:
```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  archive_path TEXT NOT NULL,
  image_id TEXT,
  page_index INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  thumbnail_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(archive_path, page_index)
);

CREATE INDEX idx_bookmarks_archive ON bookmarks(archive_path);
CREATE INDEX idx_bookmarks_created ON bookmarks(created_at DESC);
```

---

### ViewingSession

Represents the current state of viewing an archive.

**TypeScript Interface**:
```typescript
interface ViewingSession {
  // Identification
  id: string                    // UUID
  archiveId: string             // Active archive ID
  archivePath: string           // Archive file path (for persistence)

  // Navigation state
  currentPageIndex: number      // Current page (0-based)
  readingDirection: ReadingDirection // LTR or RTL

  // View settings
  viewMode: ViewMode            // SINGLE | TWO_PAGE
  zoomLevel: number             // 1.0 = 100%, 0.5 = 50%, 2.0 = 200%
  fitMode: FitMode              // FIT_WIDTH | FIT_HEIGHT | ACTUAL_SIZE | CUSTOM
  rotation: Rotation            // 0 | 90 | 180 | 270 degrees

  // UI visibility
  showThumbnails: boolean       // Thumbnail panel visible
  showFolderTree: boolean       // Folder tree panel visible
  showBookmarks: boolean        // Bookmark panel visible

  // Filter/search
  activeFolderId?: string       // If set, show only images from this folder
  searchQuery?: string          // Active search filter

  // Timestamps
  startedAt: number             // Session start
  lastActivityAt: number        // Last interaction (for auto-resume)
}

enum ViewMode {
  SINGLE = 'single',            // One page at a time
  TWO_PAGE = 'two_page'         // Two pages side-by-side
}

enum ReadingDirection {
  LTR = 'ltr',                  // Left-to-right (Western comics, photos)
  RTL = 'rtl'                   // Right-to-left (Manga, some comics)
}

enum FitMode {
  FIT_WIDTH = 'fit_width',      // Fit to window width
  FIT_HEIGHT = 'fit_height',    // Fit to window height
  ACTUAL_SIZE = 'actual_size',  // 100% (no scaling)
  CUSTOM = 'custom'             // Manual zoom (use zoomLevel)
}

enum Rotation {
  NONE = 0,
  CLOCKWISE_90 = 90,
  ROTATE_180 = 180,
  COUNTERCLOCKWISE_90 = 270
}
```

**Validation Rules**:
- `currentPageIndex` must be within [0, totalImageCount - 1]
- `zoomLevel` must be within [0.1, 10.0] (10% to 1000%)
- `rotation` must be one of 0, 90, 180, 270
- In TWO_PAGE mode with RTL, pages display right-to-left

**Persistence**:
- Saved to SQLite database on every navigation/setting change (debounced 500ms)
- Automatically restored when reopening same archive
- Pruned after 90 days of inactivity (configurable)

**Database Schema**:
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  archive_path TEXT NOT NULL UNIQUE,
  current_page_index INTEGER NOT NULL,
  reading_direction TEXT NOT NULL DEFAULT 'ltr',
  view_mode TEXT NOT NULL DEFAULT 'single',
  zoom_level REAL NOT NULL DEFAULT 1.0,
  fit_mode TEXT NOT NULL DEFAULT 'fit_width',
  rotation INTEGER NOT NULL DEFAULT 0,
  show_thumbnails INTEGER NOT NULL DEFAULT 1,
  show_folder_tree INTEGER NOT NULL DEFAULT 0,
  show_bookmarks INTEGER NOT NULL DEFAULT 0,
  active_folder_id TEXT,
  search_query TEXT,
  started_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at DESC);
```

---

## Derived Data & Computed Properties

### Current Page(s) in Two-Page Mode

**Logic**:
```typescript
function getCurrentPages(session: ViewingSession, images: Image[]): Image[] {
  const { currentPageIndex, viewMode, readingDirection } = session

  if (viewMode === ViewMode.SINGLE) {
    return [images[currentPageIndex]]
  }

  // Two-page mode
  if (readingDirection === ReadingDirection.LTR) {
    // Left page: even index, Right page: odd index
    const leftIndex = currentPageIndex % 2 === 0 ? currentPageIndex : currentPageIndex - 1
    const rightIndex = leftIndex + 1

    return [
      images[leftIndex],
      rightIndex < images.length ? images[rightIndex] : null
    ].filter(Boolean)
  } else {
    // RTL: Right page: even index, Left page: odd index
    const rightIndex = currentPageIndex % 2 === 0 ? currentPageIndex : currentPageIndex - 1
    const leftIndex = rightIndex + 1

    return [
      leftIndex < images.length ? images[leftIndex] : null,
      images[rightIndex]
    ].filter(Boolean)
  }
}
```

### Filtered Images

**Logic**:
```typescript
function getFilteredImages(
  images: Image[],
  session: ViewingSession
): Image[] {
  let filtered = images

  // Folder filter
  if (session.activeFolderId) {
    const folder = findFolderById(session.activeFolderId)
    filtered = getAllImagesInFolder(folder) // includes subfolders
  }

  // Search filter
  if (session.searchQuery) {
    const query = session.searchQuery.toLowerCase()
    filtered = filtered.filter(img =>
      img.fileName.toLowerCase().includes(query)
    )
  }

  return filtered
}
```

### Thumbnail Cache Size

**Logic**:
```typescript
async function calculateCacheSize(): Promise<number> {
  const thumbnails = await listAllThumbnails()
  return thumbnails.reduce((sum, t) => sum + t.fileSize, 0)
}

async function evictIfNeeded(maxSize: number): Promise<void> {
  let currentSize = await calculateCacheSize()

  while (currentSize > maxSize) {
    const oldest = await findLeastRecentlyUsed()
    await deleteThumbnail(oldest.id)
    currentSize -= oldest.fileSize
  }
}
```

---

## State Transitions

### Archive Lifecycle

```
[UNOPENED]
    ↓ (user opens file)
[OPENING] → read headers, detect format, check password
    ↓
[PASSWORD_REQUIRED]? → prompt user
    ↓
[SCANNING] → list entries, build folder tree, count images
    ↓
[OPEN] → ready for viewing
    ↓ (user closes or opens different archive)
[CLOSING] → cleanup resources
    ↓
[CLOSED]
```

### Thumbnail Generation

```
[NOT_STARTED]
    ↓ (thumbnail requested)
[QUEUED] → added to generation queue
    ↓
[EXTRACTING] → extract image from archive
    ↓
[GENERATING] → resize with sharp
    ↓
[CACHING] → write to disk
    ↓
[READY] → available for display

[ERROR] ← (any step fails)
```

### Bookmark Operations

```
[NO_BOOKMARK]
    ↓ (user adds bookmark)
[CREATING] → generate thumbnail, save to DB
    ↓
[SAVED]
    ↓ (user edits note)
[UPDATING] → update DB
    ↓
[SAVED]
    ↓ (user deletes)
[DELETING] → remove from DB, delete thumbnail
    ↓
[DELETED]
```

---

## Data Flow Examples

### Opening Archive → Displaying First Image

```
1. User: File > Open → selects "comic.cbz"

2. Main Process:
   - Create Archive entity
   - Detect format (CBZ = ZIP)
   - Open ZIP, list entries
   - Filter for image files
   - Build FolderNode tree
   - Sort images naturally
   - Save Archive to memory

3. IPC → Renderer:
   - Send Archive metadata
   - Send Image[] list (without binary data)
   - Send FolderNode tree

4. Renderer:
   - Create ViewingSession (or restore if exists)
   - Request thumbnail generation for first 50 images
   - Request full image data for currentPageIndex (0)

5. Main Process:
   - Generate thumbnail for Image[0] → cache to disk
   - Extract Image[0] from archive → Buffer

6. IPC → Renderer:
   - Send thumbnail path
   - Send image Buffer

7. Renderer:
   - Display image in Canvas
   - Render thumbnail grid
```

### Navigating to Next Page

```
1. User: Press Right Arrow

2. Renderer:
   - Update ViewingSession.currentPageIndex += 1
   - Check if image data already in LRU cache
   - If not cached: Request from Main Process

3. Main Process:
   - Extract image from archive
   - Return Buffer

4. Renderer:
   - Update Canvas with new image
   - Prefetch next 2 images in background
   - Update session in DB (debounced)
```

### Adding Bookmark

```
1. User: Click "Add Bookmark" button

2. Renderer:
   - Show bookmark dialog with current page
   - User enters note
   - Send bookmark data to Main Process

3. Main Process:
   - Create Bookmark entity
   - Copy thumbnail to bookmarks directory
   - Insert into SQLite database
   - Return success

4. Renderer:
   - Update UI (show bookmark indicator)
   - Add to bookmark list
```

---

## Constraints & Invariants

### Memory Constraints

- **Full Images**: Keep max 10 full-resolution images in memory (LRU cache)
- **Thumbnails**: Generate on-demand, cache to disk
- **Archive Handles**: Only one archive file handle open at a time per archive
- **Folder Tree**: Full tree kept in memory (typically <1MB even for large archives)

### Database Constraints

- **Bookmarks**: One bookmark per (archive_path, page_index) pair
- **Sessions**: One session per archive_path
- **Foreign Keys**: No strict foreign keys (archive files can be moved/deleted)

### File System Constraints

- **Thumbnail Cache**: Max 5GB (configurable), LRU eviction
- **Cache Location**: User data directory (~/.myViewer/cache/)
- **Database Location**: User data directory (~/.myViewer/database.sqlite)

---

## Performance Considerations

### Indexing Strategy

**SQLite Indexes**:
```sql
-- Bookmarks: Fast lookup by archive
CREATE INDEX idx_bookmarks_archive ON bookmarks(archive_path)

-- Bookmarks: Fast sort by creation date
CREATE INDEX idx_bookmarks_created ON bookmarks(created_at DESC)

-- Sessions: Fast cleanup of old sessions
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at DESC)
```

### Memory Optimization

**Image Loading**:
- Lazy load dimensions (only when needed for two-page layout)
- Stream extraction from archive (don't load entire archive into memory)
- Progressive JPEG decoding for large files

**Thumbnail Generation**:
- Background worker thread (don't block main thread)
- Batch processing (generate 5 at a time)
- Prioritize visible thumbnails first

### Caching Strategy

**Three-Tier Cache**:
1. **Memory**: Last 10 full images (fastest)
2. **Disk**: Thumbnail cache (fast, persistent)
3. **Archive**: Source images (slower, requires extraction)

---

## Validation & Error Handling

### Archive Validation

```typescript
interface ArchiveValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

function validateArchive(archive: Archive): ArchiveValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Must contain images
  if (archive.totalImageCount === 0) {
    errors.push('Archive contains no supported image files')
  }

  // Path traversal check
  for (const image of getAllImages(archive)) {
    if (image.pathInArchive.includes('..')) {
      errors.push(`Potential path traversal: ${image.pathInArchive}`)
    }
  }

  // Warn about password protection
  if (archive.isPasswordProtected) {
    warnings.push('Archive is password protected')
  }

  // Warn about very large archives
  if (archive.fileSize > 10 * 1024 * 1024 * 1024) { // 10GB
    warnings.push('Archive exceeds 10GB; may experience slower loading')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
```

### Bookmark Recovery

```typescript
// When archive is moved/renamed, bookmarks use pageIndex fallback
async function resolveBookmarkImage(
  bookmark: Bookmark,
  archive: Archive
): Promise<Image | null> {
  // Try imageId first
  if (bookmark.imageId) {
    const image = archive.images.find(i => i.id === bookmark.imageId)
    if (image) return image
  }

  // Fallback to pageIndex
  if (bookmark.pageIndex < archive.images.length) {
    return archive.images[bookmark.pageIndex]
  }

  // Bookmark points to non-existent page
  return null
}
```

---

## Type Definitions Summary

See `src/shared/types/` for complete TypeScript definitions:

- **`Archive.ts`**: Archive, ArchiveFormat
- **`Image.ts`**: Image, ImageFormat, ImageDimensions
- **`FolderNode.ts`**: FolderNode
- **`Thumbnail.ts`**: Thumbnail, ThumbnailStatus, ThumbnailCache
- **`Bookmark.ts`**: Bookmark
- **`ViewingSession.ts`**: ViewingSession, ViewMode, ReadingDirection, FitMode, Rotation

---

**Data Model Complete**: 2025-10-28
**Ready for**: API Contract Definition (IPC)
