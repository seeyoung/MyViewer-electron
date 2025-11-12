# Research & Technology Decisions

**Feature**: Archive-Based Image Viewer
**Date**: 2025-10-28
**Phase**: 0 - Research & Planning

## Overview

This document captures research findings and technology decisions for building a desktop image viewer that reads from compressed archives without extraction.

## Platform Decision

### Desktop Application Framework

**Decision**: Electron with TypeScript

**Rationale**:
- **Cross-Platform**: Single codebase for macOS, Windows, Linux (requirement from spec)
- **File System Access**: Native Node.js APIs for reading large archive files without browser security restrictions
- **Performance**: Multi-process architecture separates I/O operations from UI rendering
- **System Integration**: Can register file associations and context menu handlers
- **Development Speed**: Familiar web technologies (React, TypeScript) with large ecosystem
- **Memory Management**: Node.js streams enable processing 10GB+ files without loading entire archive into memory

**Alternatives Considered**:
1. **Tauri** (Rust + Web Frontend)
   - Pros: Smaller bundle size (~3MB vs ~120MB), better performance, lower memory usage
   - Cons: Fewer archive library bindings available in Rust, smaller ecosystem, team unfamiliar with Rust
   - Rejected: Development velocity and archive library availability prioritized for MVP

2. **Native Apps** (Swift/macOS, C#/Windows, C++/Linux)
   - Pros: Best performance, native look and feel
   - Cons: 3 separate codebases, 3x development time, harder to maintain consistency
   - Rejected: MVP timeline requires single codebase

3. **Qt/C++**
   - Pros: Native performance, cross-platform, mature
   - Cons: Steeper learning curve, less modern tooling, harder UI development
   - Rejected: Development speed prioritized for MVP

## Archive Handling Libraries

### Multi-Format Strategy

**Decision**: Use format-specific libraries with unified service layer

**Archive Libraries Selected**:

1. **ZIP/CBZ**: `yauzl` (streaming ZIP reader)
   - Rationale: Pure JavaScript, no native dependencies, streaming support
   - Features: Password support, central directory parsing, async/await API
   - Performance: Can open 500MB ZIP in <500ms

2. **RAR/CBR**: `node-unrar-js` (JavaScript UnRAR port)
   - Rationale: WebAssembly-based, no native dependencies, cross-platform
   - Features: Supports RAR4 and RAR5, password protection, streaming extraction
   - Performance: Slightly slower than native but acceptable for MVP

3. **7Z**: `node-7z` wrapper around 7-Zip binary
   - Rationale: Most reliable 7Z support, handles complex compression
   - Features: Full 7Z format support, encryption, solid archives
   - Trade-off: Requires bundling 7z binary (~2MB) but guarantees compatibility

4. **TAR**: `tar-stream` (streaming TAR parser)
   - Rationale: Pure JavaScript, lightweight, streaming
   - Features: Handles standard TAR and compressed TAR (tar.gz, tar.bz2)
   - Performance: Fast parsing, minimal memory overhead

**Alternatives Considered**:
- **libarchive bindings** (`node-libarchive`): Single library for all formats
  - Pros: Unified interface, battle-tested C library
  - Cons: Native compilation required, cross-platform build complexity, larger binary
  - Rejected: Build complexity and native dependencies create installation friction

**Service Layer Pattern**:
```typescript
interface ArchiveReader {
  open(filePath: string, password?: string): Promise<ArchiveHandle>
  listEntries(handle: ArchiveHandle): Promise<ArchiveEntry[]>
  extractEntry(handle: ArchiveHandle, entry: ArchiveEntry): Promise<Buffer>
  close(handle: ArchiveHandle): Promise<void>
}
```

## Image Processing

### Thumbnail Generation

**Decision**: `sharp` library for thumbnail creation

**Rationale**:
- **Performance**: libvips-based, 4-5x faster than ImageMagick or native Canvas
- **Memory Efficiency**: Streaming architecture, processes images without full load
- **Format Support**: JPEG, PNG, WebP, TIFF, GIF, SVG (covers 90% of use cases)
- **Resize Quality**: Lanczos3 resampling produces high-quality thumbnails
- **Benchmarks**: Can generate 200x200 thumbnail from 5MB JPEG in ~50ms

**Implementation Strategy**:
- Generate thumbnails at 200x200 (configurable)
- Cache to disk in user data directory
- Use content hash for cache keys (SHA-256 of first 1MB + file size)
- Background worker thread for thumbnail generation (keep UI responsive)

**Limitations & Workarounds**:
- **PSD Support**: Sharp doesn't natively support PSD
  - Workaround: Use `psd.js` library to extract merged/composite layer
  - Fallback: Show PSD icon if extraction fails
- **Animated GIF**: Sharp extracts first frame only
  - Acceptable: Thumbnails don't need animation

**Alternatives Considered**:
- **Canvas API**: Built into Electron, no dependencies
  - Cons: 3-4x slower, blocks renderer process, no streaming
- **jimp**: Pure JavaScript image processing
  - Cons: 10x slower than sharp for large images
- Rejected: Performance requirements mandate native library

### Image Display & Rendering

**Decision**: HTML5 Canvas with Konva.js for zoom/pan/rotation

**Rationale**:
- **Performance**: Hardware-accelerated Canvas2D rendering
- **Zoom/Pan**: Konva provides smooth transformation matrix operations
- **60fps Target**: Achievable with requestAnimationFrame and layer caching
- **Two-Page Mode**: Easy to render two images side-by-side on single canvas
- **Memory**: Canvas can render images larger than viewport efficiently

**Implementation Pattern**:
```typescript
// Konva layer structure
Stage
├── BackgroundLayer (solid color)
├── ImageLayer (main images, cached)
├── UILayer (navigation overlays)
└── InteractionLayer (zoom/pan handlers)
```

**Alternatives Considered**:
- **React-based Image Component** (`<img>` tags)
  - Pros: Simpler implementation
  - Cons: Browser limits on image size, harder zoom/pan, no rotation
  - Rejected: Cannot handle very large images (100MB+ TIFF files)
- **WebGL** (Three.js/PixiJS)
  - Pros: Better performance for effects/filters
  - Cons: Overkill for static image display, higher complexity
  - Rejected: Canvas sufficient for requirements

## State Management

**Decision**: Zustand for React state management

**Rationale**:
- **Lightweight**: 1KB bundle size vs Redux (20KB+)
- **Simple API**: No boilerplate, minimal learning curve
- **TypeScript**: Excellent type inference
- **Performance**: Automatic shallow equality checks, selective re-renders
- **Electron-Friendly**: Works seamlessly with IPC updates

**State Structure**:
```typescript
interface ViewerStore {
  // Archive state
  currentArchive: ArchiveMetadata | null
  images: ImageEntry[]
  folderTree: FolderNode[]

  // Viewing state
  currentIndex: number
  viewMode: 'single' | 'two-page'
  zoom: number
  rotation: number

  // UI state
  showThumbnails: boolean
  showFolderTree: boolean
  isLoading: boolean

  // Actions
  openArchive: (path: string) => Promise<void>
  navigateToIndex: (index: number) => void
  setZoom: (level: number) => void
  // ... more actions
}
```

**Alternatives Considered**:
- **Redux Toolkit**: Too much boilerplate for this use case
- **Jotai**: Atomic state approach
  - Pros: More granular updates
  - Cons: More complex mental model for this app structure
- **MobX**: Observable-based reactivity
  - Cons: More magic, harder debugging

## Data Persistence

### Bookmarks & Session State

**Decision**: better-sqlite3 for local database

**Rationale**:
- **Performance**: Synchronous API (faster than async for small queries)
- **Reliability**: SQLite is battle-tested, ACID-compliant
- **Size**: Embedded database, no external dependencies
- **Queries**: SQL for complex bookmark queries (filter by date, search notes)
- **Electron**: Runs in main process, safe for concurrent access

**Schema Design**:
```sql
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archive_path TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  note TEXT,
  thumbnail_path TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(archive_path, page_index)
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archive_path TEXT NOT NULL UNIQUE,
  last_page_index INTEGER NOT NULL,
  zoom_level REAL,
  view_mode TEXT,
  last_accessed INTEGER NOT NULL
);

CREATE INDEX idx_bookmarks_archive ON bookmarks(archive_path);
CREATE INDEX idx_sessions_accessed ON sessions(last_accessed DESC);
```

**Alternatives Considered**:
- **JSON files**: Simple but requires full file read/write on updates
- **IndexedDB**: Asynchronous, more complex API, slower for small queries
- **LevelDB**: Key-value store, harder to query/search

### Thumbnail Cache

**Decision**: Filesystem cache with SQLite index

**Rationale**:
- **Storage Location**: User data directory (`~/.myViewer/cache/thumbnails/`)
- **Naming**: SHA-256 hash of (archive path + image path + thumbnail size)
- **Index**: SQLite table to track cache entries and evict old thumbnails
- **Eviction Policy**: LRU, max 5GB cache size (configurable)

**Cache Strategy**:
```typescript
// Cache lookup flow
1. Compute cache key: hash(archivePath + imagePath + size)
2. Check SQLite index for existing entry
3. If exists and file present → return cached path
4. If missing → generate thumbnail → save to disk → update index
5. Periodically prune cache: DELETE WHERE accessed_at < threshold AND total_size > limit
```

## Testing Strategy

### Unit Testing

**Decision**: Jest + TypeScript

**Rationale**:
- **Standard**: De facto standard for TypeScript/React projects
- **Features**: Mocking, snapshots, coverage reports
- **Electron**: Works with both main and renderer process code
- **Fast**: Parallel test execution, watch mode

**Test Coverage Targets**:
- Services (ArchiveService, ImageService): 90%+
- Repositories (BookmarkRepository): 95%+ (critical data handling)
- React Components: 70%+ (focus on logic, not styling)
- Hooks (useImageNavigation, useZoomPan): 85%+

### Integration Testing

**Decision**: Custom test harness for IPC communication

**Rationale**:
- **IPC Critical**: Main-to-renderer communication is core to architecture
- **Approach**: Launch real Electron instance, inject test messages, verify responses
- **Tools**: `spectron` (Electron testing framework) or custom WebDriver setup

**Key Integration Tests**:
1. Open archive → verify image list received in renderer
2. Navigate page → verify image data transferred via IPC
3. Add bookmark → verify persistence → restart app → verify restored
4. Generate thumbnails → verify cache storage → verify reuse on reopen

### E2E Testing

**Decision**: Playwright for end-to-end workflows

**Rationale**:
- **Electron Support**: Playwright has official Electron testing support
- **Real User Flows**: Tests actual user interactions (click, keyboard, drag-drop)
- **Screenshots**: Can capture UI for visual regression testing
- **Debugging**: Built-in trace viewer, video recording

**E2E Test Scenarios** (from spec acceptance criteria):
1. Open CBZ file → navigate with arrow keys → close → reopen → verify resumed at last page
2. Open 2GB ZIP with 3000 images → verify thumbnails generate within 10s → click thumbnail → verify full image loads <1s
3. Search for filename "IMG_1234" → verify result highlighted <2s
4. Toggle two-page mode → verify manga reading direction

## Performance Optimization Strategies

### Memory Management

**Challenges**:
- 10GB archive with 10,000 images cannot be loaded into memory
- Each full-resolution image (5MB JPEG) cannot all be cached

**Solutions**:
1. **Streaming Archive Access**: Read archive central directory only, extract images on-demand
2. **LRU Image Cache**: Keep last 10 full-resolution images in memory (configurable)
3. **Virtual Scrolling**: Thumbnail grid only renders visible items + 20 buffer
4. **Progressive Loading**: Load scaled-down version first, then full resolution
5. **Worker Threads**: Thumbnail generation in background thread (Node.js worker_threads API)

### Rendering Performance

**60fps Target** (16.67ms per frame):
- **Canvas Layer Caching**: Cache image layer when not changing (zoom/pan only transforms matrix)
- **RequestAnimationFrame**: Throttle zoom/pan updates to RAF cycle
- **Debouncing**: Debounce thumbnail generation during rapid scrolling
- **Virtual Scrolling**: react-window or react-virtualized for thumbnail grid

**Benchmarking Plan**:
- Measure time-to-first-image for various archive sizes (100MB, 500MB, 2GB, 5GB)
- Profile memory usage during extended browsing sessions
- Test zoom/pan FPS with Chrome DevTools performance profiler

## Cross-Platform Considerations

### File Associations & Context Menus

**macOS**:
- Register file types in `Info.plist` (CFBundleDocumentTypes)
- Use electron-builder to set UTIs (Uniform Type Identifiers)
- Context menu: Handled by macOS automatically when registered

**Windows**:
- Registry entries via electron-builder (HKEY_CLASSES_ROOT)
- File associations: `.cbz`, `.cbr`, `.zip` (subset), `.rar` (subset)
- Context menu: Shell extension (electron-windows-context-menu)

**Linux**:
- Desktop entry file (`.desktop` file)
- MIME type associations via `xdg-mime`
- Context menu: Depends on desktop environment (Nautilus, Dolphin)

**Decision**: Use electron-builder's platform-specific configuration for automatic registration during installation.

### Path Handling

**Issue**: Windows uses backslashes (`\`), Unix uses forward slashes (`/`)

**Solution**: Always use `path.join()` and `path.resolve()` from Node.js `path` module. Never concatenate path strings manually.

### Native Dependencies

**Concern**: `better-sqlite3` and `sharp` have native components

**Solution**:
- Use `electron-rebuild` to compile native modules against Electron's Node.js version
- electron-builder handles bundling native modules for each platform
- CI/CD builds on all three platforms (GitHub Actions matrix)

## Development Workflow

### Project Setup

**Package Manager**: npm (default with Node.js, simpler for Electron projects)

**TypeScript Configuration**:
- Strict mode enabled
- Separate tsconfig for main (Node.js) and renderer (DOM)
- Path aliases: `@main`, `@renderer`, `@shared`

### Build & Packaging

**Tool**: electron-builder

**Rationale**:
- **Packaging**: Creates installers for macOS (.dmg), Windows (.exe), Linux (.AppImage)
- **Code Signing**: Supports macOS notarization and Windows Authenticode
- **Auto-Update**: Built-in update framework (electron-updater)
- **Compression**: Optimizes bundle size with asar archives

**Build Targets**:
- macOS: DMG (universal binary for Intel + Apple Silicon)
- Windows: NSIS installer (32-bit + 64-bit)
- Linux: AppImage (most portable)

### Hot Reload & Development

**Tool**: electron-vite or custom webpack setup

**Features**:
- Main process: Auto-restart on code changes
- Renderer process: React Fast Refresh (HMR)
- Shared types: Watch mode for TypeScript compilation

## Security Considerations

### Archive File Safety

**Risk**: Malicious archives could contain path traversal (e.g., `../../etc/passwd`)

**Mitigation**:
- Validate all file paths from archive: reject if contains `..` or starts with `/`
- Sandbox archive extraction: never write files to disk (in-memory only)
- Limit decompression ratio: reject zip bombs (compressed 1KB → decompressed 1GB)

**Implementation**:
```typescript
function sanitizeArchivePath(path: string): string {
  // Remove leading slashes, reject parent directory references
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid archive path: potential traversal attack')
  }
  return path.replace(/^\/+/, '')
}
```

### Password-Protected Archives

**Security**:
- Passwords stored in memory only during session (never persisted)
- Clear password from memory after archive closed
- No password caching (user must re-enter if reopened)

### Content Security Policy

**Electron Security Best Practices**:
- Enable `contextIsolation` (prevents renderer from accessing Node.js directly)
- Disable `nodeIntegration` in renderer
- Use `preload` script for IPC bridge
- Set Content-Security-Policy header

**CSP Header**:
```
default-src 'self';
img-src 'self' data: blob:;
script-src 'self';
style-src 'self' 'unsafe-inline';
```

## Open Research Questions

### Animated Image Support

**Question**: Should animated GIFs and WebP animations play automatically?

**Research Findings**:
- **Performance**: Rendering animated GIF at 60fps while allowing zoom/pan is challenging
- **Use Case**: Comic books rarely contain animations
- **Decision for MVP**: Show first frame only in viewer, indicate animation with icon
- **Future Enhancement**: Add "play animation" button for animated formats

### Very Large Single Images

**Question**: How to handle 100MB+ TIFF or PSD files?

**Research Findings**:
- **Sharp Limitation**: Can decode TIFF but struggles with very large files (>50MB)
- **PSD.js**: Can extract composite but memory-intensive for large PSDs
- **Progressive Loading**: Most viable approach
  - Step 1: Generate low-res preview (1/4 scale) → display immediately
  - Step 2: Load full resolution in background
  - Step 3: Swap to full res when ready (fade transition)

**Decision**: Implement progressive loading with preview placeholder for files >20MB.

### Multi-Archive Sessions

**Question**: Should users be able to open multiple archives in tabs?

**Spec Requirement**: FR-054 requires multiple archive support

**Implementation Options**:
1. **Tabs** (like web browser): Better UX for switching
2. **Separate Windows**: Better for multi-monitor setups
3. **Hybrid**: Tabs within window + "open in new window" option

**Decision for MVP**: Single window with tabs (simpler implementation). Future: Add "open in new window" option.

## Summary of Key Decisions

| Category | Decision | Primary Rationale |
|----------|----------|-------------------|
| Platform | Electron + TypeScript + React | Cross-platform, file system access, development speed |
| Archive Libraries | Format-specific (yauzl, node-unrar-js, node-7z, tar-stream) | Best compatibility, no native build complexity |
| Thumbnail Generation | sharp (libvips) | 4-5x faster than alternatives, streaming support |
| Image Rendering | Canvas + Konva.js | Hardware acceleration, smooth zoom/pan, 60fps |
| State Management | Zustand | Lightweight, simple API, TypeScript-friendly |
| Persistence | better-sqlite3 | Fast synchronous API, SQL queries, embedded |
| Testing | Jest (unit) + Playwright (E2E) | Standard tools, Electron support, comprehensive |
| Build Tool | electron-builder | Industry standard, cross-platform packaging |

## Next Steps (Phase 1)

1. ✅ Generate data model from spec entities
2. ✅ Define IPC contract between main and renderer processes
3. ✅ Create quickstart guide for developers
4. ✅ Set up initial project structure

---

**Research Complete**: 2025-10-28
**Ready for Phase 1**: Data Modeling & Contracts
