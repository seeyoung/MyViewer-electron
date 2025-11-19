# Clean Code Review Report

**Date:** 2025-11-19
**Project:** MyViewer-electron

## 📊 Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Main Process | 2 | 5 | 7 | 4 | 18 |
| Renderer Process | 1 | 6 | 24 | 21 | 52 |
| Shared/Utility | 2 | 5 | 7 | 6 | 20 |
| **Total** | **5** | **16** | **38** | **31** | **90** |

## 1. 🚨 Critical Issues (Security & Stability)

### 1.1 Web Security Disabled
- **File:** `src/main/index.ts`
- **Issue:** `webSecurity: false` is set in the `BrowserWindow` configuration.
- **Risk:** Disables Same-Origin Policy, exposing the app to XSS and other web-based attacks.
- **Recommendation:** Enable `webSecurity: true`. Implement a custom protocol (e.g., `myviewer://`) to serve local resources securely.

### 1.2 Shell Command Injection
- **File:** `src/main/services/archive/RarReader.ts`
- **Issue:** `exec` is used with a command string constructed by concatenating `filePath` and `password`.
- **Risk:** Malicious filenames or passwords could execute arbitrary shell commands.
- **Recommendation:** Use `execFile` or `spawn` and pass arguments as an array to prevent shell interpretation.

### 1.3 Incomplete Path Traversal Protection
- **File:** `src/lib/file-utils.ts`
- **Issue:** Current sanitization might be bypassed by URL encoding or symlinks.
- **Recommendation:** Enhance `validatePath` to handle URL decoding and check for symlinks resolving outside the target directory.

### 1.4 Component Complexity
- **File:** `src/renderer/components/slideshow/SlideshowManagerPanel.tsx`
- **Issue:** 548 lines, 13+ state variables, mixed UI and logic.
- **Recommendation:** Split into smaller sub-components (e.g., `SlideshowList`, `SlideshowControls`, `SlideshowQueue`).

### 1.5 Type Safety Violations
- **File:** `src/shared/types/Image.ts`
- **Issue:** Domain data (`id`, `path`) is mixed with runtime state (`isLoaded`, `isCorrupted`).
- **Recommendation:** Split into `ImageMetadata` (readonly, persistent) and `ImageRuntimeState` (transient).

## 2. 🔴 High Priority Issues (Architecture & Maintainability)

### 2.1 Main Process Code Duplication
- **Files:** `src/main/services/ArchiveService.ts`, `src/main/services/FolderService.ts`
- **Issue:** `buildFolderTree` logic is duplicated (100+ lines).
- **Recommendation:** Extract common logic into a `FolderTreeBuilder` utility.

### 2.2 IPC Handler Bloat & Duplication
- **File:** `src/main/ipc/handlers.ts`
- **Issue:** File is ~400 lines. Serialization logic is repeated for `ARCHIVE_OPEN` and `FOLDER_OPEN`.
- **Recommendation:**
    - Split handlers into separate files (e.g., `archiveHandlers.ts`, `imageHandlers.ts`).
    - Create a `createSerializableResponse` helper function.

### 2.3 Excessive Function Length
- **File:** `src/main/services/ArchiveService.ts`
- **Issue:** `openArchive` (109 lines) handles validation, opening, listing, filtering, and tree building.
- **Recommendation:** Break down into `validateFile`, `getReader`, `parseEntries`, `filterImages`.

### 2.4 Renderer Component Bloat
- **Files:** `App.tsx`, `ImageViewer.tsx`, `NavigationBar.tsx`
- **Issue:** Large components with mixed concerns (layout, logic, styling).
- **Recommendation:**
    - Extract custom hooks (e.g., `useViewerLayout`, `useImageLoader`).
    - Move inline styles to CSS modules.

### 2.5 Monolithic Store
- **File:** `src/renderer/store/viewerStore.ts`
- **Issue:** Single store managing UI, Data, and Feature state (484 lines).
- **Recommendation:** Slice the store into `createViewerSlice`, `createUISlice`, `createSlideshowSlice`.

## 3. 🟡 Medium Priority Issues

- **Performance:** `natural-sort.ts` recompiles regex on every comparison. Move regex to module scope.
- **Performance:** `RecentSourcesService.ts` uses synchronous I/O (`fs.writeFileSync`) during runtime. Switch to async.
- **Type Safety:** Widespread use of `any` in IPC handlers and `ImageViewer`.
- **React Patterns:** `document.querySelector` usage in `App.tsx` and `ImageViewer.tsx`. Use `useRef` or state.

## 4. 🟢 Low Priority Issues

- **Logging:** Excessive `console.log` in production code.
- **Documentation:** Missing JSDoc for many shared types.
- **Testing:** Low test coverage.

## 5. Action Plan

We will proceed with a phased refactoring approach:
1.  **Phase 1: Security & Critical Fixes** (WebSecurity, Command Injection, Path Validation).
2.  **Phase 2: Core Architecture** (Store splitting, Service de-duplication).
3.  **Phase 3: Component Refactoring** (Splitting large components, removing manual DOM manipulation).
4.  **Phase 4: Cleanup** (Logging, Types, Performance tweaks).
