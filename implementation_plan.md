# Clean Code Refactoring Plan

## Goal Description
Refactor the MyViewer-electron codebase to address critical security vulnerabilities, improve architectural maintainability, and enhance code quality based on the comprehensive Clean Code Review Report.

## User Review Required
> [!IMPORTANT]
> **Breaking Change**: Enabling `webSecurity: true` will require changing how local images are loaded. We will implement a custom protocol `myviewer://` to serve these files. This affects `ImageViewer.tsx` and `main/index.ts`.

> [!WARNING]
> **Database Migration**: Splitting `Image` types might require updates to how we store/retrieve data if we decide to persist metadata differently, though initially this is a TypeScript-level refactor.

## Proposed Changes

### Phase 1: Security & Critical Fixes (Immediate)

#### [MODIFY] [index.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/index.ts)
- Enable `webSecurity: true`.
- Register `myviewer` custom protocol to serve local files securely.

#### [MODIFY] [RarReader.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/services/archive/RarReader.ts)
- Replace `exec` with `spawn` or `execFile`.
- Pass arguments as an array to prevent command injection.

#### [MODIFY] [file-utils.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/lib/file-utils.ts)
- Enhance `validatePath` to handle URL decoding and symlink checks.

### Phase 2: Core Architecture (High Priority)

#### [NEW] [FolderTreeBuilder.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/services/FolderTreeBuilder.ts)
- Extract `buildFolderTree` logic here.

#### [MODIFY] [ArchiveService.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/services/ArchiveService.ts)
- Use `FolderTreeBuilder`.
- Break down `openArchive` into smaller methods.

#### [MODIFY] [FolderService.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/services/FolderService.ts)
- Use `FolderTreeBuilder`.

#### [MODIFY] [handlers.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/ipc/handlers.ts)
- Extract serialization logic to helper.
- (Optional) Split into multiple files if time permits.

### Phase 3: Component Refactoring (Medium Priority)

#### [MODIFY] [SlideshowManagerPanel.tsx](file:///Users/seeyoung/projects/MyViewer-electron/src/renderer/components/slideshow/SlideshowManagerPanel.tsx)
- Split into `SlideshowQueueList`, `SlideshowControls`.

#### [MODIFY] [App.tsx](file:///Users/seeyoung/projects/MyViewer-electron/src/renderer/App.tsx)
- Replace `document.querySelector` with `useRef` / React state.

### Phase 4: Advanced Refactoring (Current Focus)

#### [NEW] [src/renderer/store/slices/](file:///Users/seeyoung/projects/MyViewer-electron/src/renderer/store/slices/)
- Create `viewerSlice.ts`, `uiSlice.ts`, `slideshowSlice.ts`.

#### [MODIFY] [viewerStore.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/renderer/store/viewerStore.ts)
- Refactor to combine slices using `create<ViewerState>()((...a) => ({ ...createViewerSlice(...a), ...createUISlice(...a), ... }))`.

#### [NEW] [src/main/ipc/handlers/](file:///Users/seeyoung/projects/MyViewer-electron/src/main/ipc/handlers/)
- Create `archiveHandlers.ts`, `imageHandlers.ts`, `sessionHandlers.ts`, `commonHandlers.ts`.

#### [MODIFY] [handlers.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/ipc/handlers.ts)
- Import and register handlers from the new files.

#### [MODIFY] [RecentSourcesService.ts](file:///Users/seeyoung/projects/MyViewer-electron/src/main/services/RecentSourcesService.ts)
- Convert `save()` to `async save()`.
- Update usages in handlers to await the save operation.

## Verification Plan

### Automated Tests
- Run existing tests: `npm test`
- Verify build: `npm run build`

### Manual Verification
- **Security**: Try opening a file with special characters in the name. Verify images load with `webSecurity: true`.
- **Functionality**: Open ZIP/RAR archives, verify folder tree structure is correct (regression test for `FolderTreeBuilder`).
- **Slideshow**: Verify slideshow manager still works after component split.
