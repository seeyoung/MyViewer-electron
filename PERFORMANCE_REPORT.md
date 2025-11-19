# Performance Review Report

## Executive Summary
The application has a solid foundation but suffers from critical performance bottlenecks in archive handling and image loading. The most significant issue is the **O(N) complexity for image extraction** in ZIP files, which causes exponential slowdowns as users navigate deeper into archives. Additionally, the use of **Base64 for IPC image transfer** adds unnecessary CPU and memory overhead.

## Critical Issues (Immediate Action Required)

### 1. O(N) ZIP Extraction Complexity
**Location:** `src/main/services/archive/ZipReader.ts`
**Issue:**
The `extractEntry` method re-opens the ZIP file and iterates from the beginning for every single image load until it finds the matching filename.
- **Impact:** Loading the 1000th image requires reading and skipping 999 entries. This makes the viewer extremely slow for large archives.
- **Solution:** Cache `yauzl.Entry` objects during `listEntries` in a Map (`Map<string, yauzl.Entry>`). Use this map to directly call `openReadStream` in `extractEntry` without re-scanning.

### 2. Base64 IPC Overhead
**Location:** `src/renderer/components/viewer/ImageViewer.tsx` & `src/main/services/ImageService.ts`
**Issue:**
Full-resolution images are converted to Base64 strings in the main process, sent over IPC, and then assigned to `img.src`.
- **Impact:**
    - Increases memory usage by ~33% (Base64 overhead).
    - Blocks the main thread during conversion.
    - Slows down IPC transfer.
    - Causes garbage collection spikes.
- **Solution:**
    - **Short term:** Use `nativeImage` or `Buffer` transfer (Electron supports fast buffer passing).
    - **Long term:** Implement a custom protocol (e.g., `myviewer://archive/{id}/{path}`) to serve images directly from the main process. This allows the renderer to load images via standard `<img>` tags without manual IPC handling, leveraging the browser's native caching and decoding.

## Major Issues (High Priority)

### 3. Lack of List Virtualization
**Location:** `src/renderer/components/viewer/BottomThumbnails.tsx` & `FolderSidebar.tsx`
**Issue:**
These components render all items (up to 300 or more) into the DOM.
- **Impact:** High memory usage and slow initial rendering/updates when opening folders with many images.
- **Solution:** Implement `react-window` or `react-virtualized` to render only the visible items. This is essential for scaling to folders with thousands of images.

### 4. Unbounded Thumbnail Concurrency
**Location:** `src/main/services/ThumbnailService.ts`
**Issue:**
While requests for the *same* image are deduplicated, there is no global limit on *total* concurrent thumbnail generations.
- **Impact:** Rapid scrolling can spawn dozens of `sharp` instances, spiking CPU usage and potentially blocking the event loop.
- **Solution:** Implement a `P-Queue` or similar concurrency limiter (e.g., max 4-6 concurrent generations) to smooth out CPU usage.

## Minor Issues (Optimization)

### 5. Excessive Logging
**Location:** `src/main/services/ArchiveService.ts`
**Issue:**
`console.log` is called inside loops (e.g., `buildFolderTree`).
- **Impact:** Slows down processing for large archives due to I/O blocking.
- **Solution:** Remove debug logs from hot paths or use a proper logging library with log levels.

### 6. Hardcoded Cache Limits
**Location:** `src/main/services/ImageService.ts`
**Issue:**
`LRUCache` is hardcoded to 10 images.
- **Impact:** "Two-page" view or fast flipping might cause cache thrashing.
- **Solution:** Make cache size configurable or dynamic based on available memory.

## Recommended Implementation Plan

1.  **Fix ZipReader (High Impact, Low Effort):** Modify `ZipReader` to cache entries.
2.  **Optimize IPC (High Impact, Medium Effort):** Switch to Custom Protocol (`myviewer://`) for image loading.
3.  **Virtualize Lists (Medium Impact, Medium Effort):** Add `react-window` to thumbnail strips and sidebars.
4.  **Concurrency Control (Medium Impact, Low Effort):** Add a queue to `ThumbnailService`.
