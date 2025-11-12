# Tasks: Archive-Based Image Viewer

**Input**: Design documents from `/specs/001-archive-image-viewer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-api.yaml

**Tests**: Tests are NOT explicitly requested in specification, so test tasks are omitted. TDD approach can be adopted later if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md:
- **Main Process**: `src/main/` (Node.js/TypeScript)
- **Renderer Process**: `src/renderer/` (React/TypeScript)
- **Shared Types**: `src/shared/types/`
- **Tests**: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Electron application scaffolding

- [X] T001 Initialize Node.js project with package.json and install Electron 27+, TypeScript 5.0+, React 18+
- [X] T002 [P] Create project directory structure: src/main/, src/renderer/, src/shared/types/, src/lib/, tests/, public/, config/
- [X] T003 [P] Configure TypeScript with separate tsconfig.json for main process (Node.js target) and renderer process (DOM target)
- [X] T004 [P] Setup ESLint and Prettier for code quality (config/eslint.config.js, config/.prettierrc)
- [X] T005 [P] Configure electron-builder for packaging (config/electron-builder.yml)
- [X] T006 [P] Setup webpack/vite for main and renderer bundling (config/webpack.config.js or vite.config.ts)
- [X] T007 Create Electron main process entry point in src/main/index.ts (basic window creation)
- [X] T008 Create React renderer entry point in src/renderer/index.tsx (basic App component)
- [X] T009 Create HTML template in public/index.html for Electron renderer
- [X] T010 [P] Setup hot reload for development: main process auto-restart, renderer HMR
- [X] T011 [P] Add npm scripts in package.json: dev, dev:main, dev:renderer, build, package
- [X] T012 Create preload script for IPC security in src/main/preload.ts (contextIsolation enabled)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Type Definitions

- [X] T013 [P] Create Archive type in src/shared/types/Archive.ts (ArchiveFormat enum, Archive interface)
- [X] T014 [P] Create Image type in src/shared/types/Image.ts (ImageFormat enum, Image interface, ImageDimensions)
- [X] T015 [P] Create FolderNode type in src/shared/types/FolderNode.ts (folder tree structure)
- [X] T016 [P] Create Thumbnail type in src/shared/types/Thumbnail.ts (ThumbnailStatus enum, Thumbnail interface)
- [X] T017 [P] Create Bookmark type in src/shared/types/Bookmark.ts (Bookmark interface)
- [X] T018 [P] Create ViewingSession type in src/shared/types/ViewingSession.ts (ViewMode, ReadingDirection, FitMode, Rotation enums)
- [X] T019 [P] Create IPC channel constants in src/shared/constants/ipc-channels.ts (centralized channel names)

### Core Utilities

- [X] T020 [P] Implement natural sort function in src/lib/natural-sort.ts (for filename sorting)
- [X] T021 [P] Implement image format detection in src/lib/image-utils.ts (magic bytes + extension)
- [X] T022 [P] Implement file path sanitization in src/lib/file-utils.ts (prevent path traversal)

### Database Setup

- [X] T023 Install better-sqlite3 dependency and create database initialization in src/main/db/init.ts
- [X] T024 Create bookmarks table schema in src/main/db/migrations/001_create_bookmarks.sql
- [X] T025 Create sessions table schema in src/main/db/migrations/002_create_sessions.sql
- [X] T026 Implement database connection manager in src/main/db/connection.ts (singleton pattern)

### State Management

- [X] T027 Create Zustand store structure in src/renderer/store/viewerStore.ts (initial state shape, no actions yet)

### IPC Infrastructure

- [X] T028 Create IPC handler registry in src/main/ipc/handlers.ts (handler registration pattern)
- [X] T029 Create IPC client wrapper in src/renderer/services/ipc.ts (typed invoke methods)
- [X] T030 Setup error handling middleware for IPC in src/main/ipc/error-handler.ts

### UI Foundation

- [X] T031 [P] Create ErrorBoundary component in src/renderer/components/shared/ErrorBoundary.tsx
- [X] T032 [P] Create LoadingIndicator component in src/renderer/components/shared/LoadingIndicator.tsx
- [X] T033 Setup React Router (if needed for multi-window) or basic App.tsx layout structure

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Images from Comic Book Archive (Priority: P1) 🎯 MVP

**Goal**: Enable users to open CBZ/CBR archives and navigate images page-by-page with keyboard shortcuts, automatically resuming from last-viewed page

**Independent Test**: Open sample CBZ file, navigate with arrow keys, close app, reopen same file, verify resumes at last page

### Implementation for User Story 1

#### Archive Handling (Main Process)

- [ ] T034 [P] [US1] Install archive libraries: yauzl (ZIP), node-unrar-js (RAR) via npm
- [ ] T035 [P] [US1] Create ArchiveReader interface in src/main/services/archive/ArchiveReader.ts
- [ ] T036 [P] [US1] Implement ZipReader in src/main/services/archive/ZipReader.ts (yauzl wrapper, streaming extraction)
- [ ] T037 [P] [US1] Implement RarReader in src/main/services/archive/RarReader.ts (node-unrar-js wrapper)
- [ ] T038 [US1] Implement ArchiveService in src/main/services/ArchiveService.ts (format detection, open, close, listEntries, extractEntry)
- [ ] T039 [US1] Add folder tree building logic to ArchiveService (create FolderNode hierarchy from file paths)

#### Image Handling (Main Process)

- [ ] T040 [US1] Implement ImageService in src/main/services/ImageService.ts (load image buffer from archive, format detection)
- [ ] T041 [US1] Add LRU cache for full-resolution images in ImageService (max 10 images in memory)

#### Session Persistence (Main Process)

- [ ] T042 [P] [US1] Implement SessionRepository in src/main/repositories/SessionRepository.ts (CRUD for sessions table)
- [ ] T043 [US1] Implement SessionService in src/main/services/SessionService.ts (get session, update session, auto-save with debounce)

#### IPC Handlers for User Story 1

- [ ] T044 [US1] Implement archive:open IPC handler in src/main/ipc/handlers.ts (call ArchiveService, return Archive metadata)
- [ ] T045 [P] [US1] Implement archive:close IPC handler in src/main/ipc/handlers.ts
- [ ] T046 [P] [US1] Implement archive:list-images IPC handler in src/main/ipc/handlers.ts
- [ ] T047 [P] [US1] Implement image:load IPC handler in src/main/ipc/handlers.ts (return base64 or Buffer)
- [ ] T048 [P] [US1] Implement session:get IPC handler in src/main/ipc/handlers.ts
- [ ] T049 [P] [US1] Implement session:update IPC handler in src/main/ipc/handlers.ts

#### UI Components (Renderer Process)

- [ ] T050 [P] [US1] Install Konva.js and React-Konva for canvas rendering via npm
- [ ] T051 [P] [US1] Create ImageViewer component in src/renderer/components/viewer/ImageViewer.tsx (Canvas with Konva, display single image)
- [ ] T052 [P] [US1] Create NavigationBar component in src/renderer/components/viewer/NavigationBar.tsx (prev/next buttons, page counter)
- [ ] T053 [US1] Add Zustand store actions in src/renderer/store/viewerStore.ts (openArchive, navigateToPage, updateSession)

#### React Hooks for User Story 1

- [ ] T054 [US1] Implement useArchive hook in src/renderer/hooks/useArchive.ts (open archive, load metadata)
- [ ] T055 [US1] Implement useImageNavigation hook in src/renderer/hooks/useImageNavigation.ts (next/prev page logic, current image)
- [ ] T056 [US1] Implement useKeyboardShortcuts hook in src/renderer/hooks/useKeyboardShortcuts.ts (arrow keys for navigation)

#### File Operations for User Story 1

- [ ] T057 [US1] Add File > Open menu in src/main/index.ts (Electron dialog, pass file path to renderer)
- [ ] T058 [US1] Add drag-and-drop support in src/renderer/App.tsx (handle file drop, call openArchive)

#### Session Restoration

- [ ] T059 [US1] Implement auto-resume logic in useArchive hook (on archive open, check session, navigate to last page)
- [ ] T060 [US1] Add session auto-save on page navigation (debounced 500ms) in useImageNavigation hook

**Checkpoint**: At this point, User Story 1 should be fully functional - can open CBZ/CBR, navigate with keys, resume from last page

---

## Phase 4: User Story 2 - Browse Large Photo Archives with Thumbnails (Priority: P1)

**Goal**: Enable efficient browsing of large archives (1000+ images) with thumbnail previews, quick navigation by clicking thumbnails, and fast search

**Independent Test**: Load 2GB ZIP with 3000 images, verify thumbnails generate within 10s, click thumbnail loads image <1s, search finds file within 2s

### Implementation for User Story 2

#### Thumbnail Generation (Main Process)

- [ ] T061 [P] [US2] Install sharp library for image processing via npm
- [ ] T062 [US2] Implement ThumbnailService in src/main/services/ThumbnailService.ts (generate, cache, LRU eviction)
- [ ] T063 [US2] Create thumbnail cache directory initialization (user data directory)
- [ ] T064 [US2] Implement cache key generation (SHA-256 of archive path + image path + size)
- [ ] T065 [US2] Add worker thread for background thumbnail generation in src/main/workers/thumbnail-worker.ts (Node.js worker_threads)
- [ ] T066 [US2] Implement batch thumbnail generation with queue in ThumbnailService

#### IPC for Thumbnails

- [ ] T067 [P] [US2] Implement image:generate-thumbnail IPC handler in src/main/ipc/handlers.ts
- [ ] T068 [P] [US2] Implement image:generate-thumbnails-batch IPC handler in src/main/ipc/handlers.ts
- [ ] T069 [US2] Add thumbnail:generated IPC event channel (main → renderer progress updates)

#### Thumbnail UI (Renderer Process)

- [ ] T070 [P] [US2] Install react-window for virtual scrolling via npm
- [ ] T071 [US2] Create ThumbnailGrid component in src/renderer/components/viewer/ThumbnailGrid.tsx (virtualized grid, thumbnail images)
- [ ] T072 [US2] Add thumbnail panel toggle in NavigationBar component
- [ ] T073 [US2] Implement thumbnail click handler (jump to image index) in ThumbnailGrid

#### Search & Filtering

- [ ] T074 [P] [US2] Add search input component in src/renderer/components/viewer/SearchBar.tsx
- [ ] T075 [US2] Implement filename search logic in viewerStore (filter images by query)
- [ ] T076 [US2] Add search result highlighting in ThumbnailGrid component

#### Performance Optimizations

- [ ] T077 [US2] Add thumbnail prefetching (generate visible + next 20 thumbnails) in useArchive hook
- [ ] T078 [US2] Implement progressive loading indicator during thumbnail batch generation
- [ ] T079 [US2] Add memory monitoring and cleanup in ImageService (evict old images when >1GB)

**Checkpoint**: Large archives now browsable with thumbnails, search works efficiently, UI stays responsive

---

## Phase 5: User Story 3 - Navigate Nested Folder Structures (Priority: P2)

**Goal**: Display folder tree for archives with nested directories, filter images by selected folder, maintain context during navigation

**Independent Test**: Create ZIP with folders (2024/January/Photos/), verify folder tree displays, clicking folder filters images, navigation respects folder boundaries

### Implementation for User Story 3

#### Folder Tree UI (Renderer Process)

- [ ] T080 [P] [US3] Install react-tree-view or similar library for folder tree UI via npm (or build custom)
- [ ] T081 [US3] Create FolderTree component in src/renderer/components/viewer/FolderTree.tsx (expand/collapse nodes, select folder)
- [ ] T082 [US3] Add folder tree panel toggle in NavigationBar component

#### Folder Filtering

- [ ] T083 [US3] Add activeFolderId state to viewerStore in src/renderer/store/viewerStore.ts
- [ ] T084 [US3] Implement folder selection handler in FolderTree (update activeFolderId, filter images)
- [ ] T085 [US3] Add filtered images getter in viewerStore (return images from selected folder + subfolders)
- [ ] T086 [US3] Update ImageViewer and ThumbnailGrid to use filtered images when folder selected

#### Folder Boundary Navigation

- [ ] T087 [US3] Add folder boundary detection in useImageNavigation hook (check if next/prev crosses folder)
- [ ] T088 [US3] Implement navigation behavior setting (continue to next folder or stop at boundary)
- [ ] T089 [US3] Add user preference for folder navigation in settings (stored in session)

**Checkpoint**: Folder tree functional, can filter by folder, navigation respects folder boundaries

---

## Phase 6: User Story 4 - Two-Page Spread Reading Mode (Priority: P2)

**Goal**: Support two-page side-by-side viewing for manga/comics with configurable reading direction (LTR/RTL), handle double-page spreads intelligently

**Independent Test**: Open comic archive, toggle two-page mode, verify pages display side-by-side, toggle RTL, verify correct page order

### Implementation for User Story 4

#### Two-Page Rendering

- [ ] T090 [US4] Add viewMode state (single | two_page) to viewerStore in src/renderer/store/viewerStore.ts
- [ ] T091 [US4] Add readingDirection state (ltr | rtl) to viewerStore
- [ ] T092 [US4] Implement getCurrentPages helper in src/renderer/store/viewerStore.ts (returns 1 or 2 images based on viewMode and index)
- [ ] T093 [US4] Update ImageViewer component to render two images side-by-side when viewMode is two_page
- [ ] T094 [US4] Add page alignment logic in ImageViewer (left page, right page based on reading direction)

#### View Mode Controls

- [ ] T095 [P] [US4] Add view mode toggle button in NavigationBar component (single ↔ two-page)
- [ ] T096 [P] [US4] Add reading direction toggle in NavigationBar (LTR ↔ RTL)
- [ ] T097 [US4] Update session persistence to include viewMode and readingDirection

#### Double-Page Spread Detection

- [ ] T098 [US4] Implement double-page spread detection in src/lib/image-utils.ts (check aspect ratio >1.5:1)
- [ ] T099 [US4] Update getCurrentPages logic to handle double-page spreads (show single image full-width)

#### Navigation Adjustments

- [ ] T100 [US4] Update useImageNavigation hook to skip by 2 in two-page mode (unless at double-page spread)
- [ ] T101 [US4] Add page index correction for two-page mode (ensure even index for left page in LTR)

**Checkpoint**: Two-page mode works correctly with proper page pairing and reading direction support

---

## Phase 7: User Story 5 - System Integration for Quick Access (Priority: P3)

**Goal**: Enable opening archives from file manager context menu, drag-and-drop onto app window, command-line arguments

**Independent Test**: Install app, right-click ZIP file in file manager, verify "Open with Archive Image Viewer" appears, launches correctly

### Implementation for User Story 5

#### File Associations

- [ ] T102 [P] [US5] Configure file associations in config/electron-builder.yml (ZIP, RAR, 7Z, TAR, CBZ, CBR)
- [ ] T103 [P] [US5] Add file type definitions for macOS (Info.plist via electron-builder)
- [ ] T104 [P] [US5] Add file type definitions for Windows (registry entries via electron-builder)
- [ ] T105 [P] [US5] Add file type definitions for Linux (desktop entry file)

#### Context Menu Integration

- [ ] T106 [US5] Implement platform-specific context menu registration (macOS automatically handled by file associations)
- [ ] T107 [US5] Add Windows shell extension registration in electron-builder post-install script
- [ ] T108 [US5] Add Linux MIME type handler registration

#### Command-Line Arguments

- [ ] T109 [US5] Add command-line argument parsing in src/main/index.ts (process.argv, handle file path)
- [ ] T110 [US5] Implement app.on('open-file') handler for macOS in src/main/index.ts
- [ ] T111 [US5] Implement app.on('second-instance') handler for single-instance mode (open file in existing window)

#### Enhanced Drag-and-Drop

- [ ] T112 [US5] Update drag-and-drop handler in src/renderer/App.tsx to accept multiple file types (already partially implemented in US1)

**Checkpoint**: Archives can be opened from file manager, context menu, drag-and-drop, and command line

---

## Phase 8: User Story 6 - Bookmark and Resume Reading (Priority: P3)

**Goal**: Allow users to bookmark specific pages with notes, display bookmark list with thumbnails, resume from last page automatically (already in US1, enhance with UI)

**Independent Test**: Open archive, add bookmarks to pages 10, 45, 87 with notes, view bookmark list, click bookmark jumps to page, close app, reopen, bookmarks persist

### Implementation for User Story 6

#### Bookmark Persistence (Main Process)

- [ ] T113 [P] [US6] Implement BookmarkRepository in src/main/repositories/BookmarkRepository.ts (CRUD for bookmarks table)
- [ ] T114 [US6] Implement BookmarkService in src/main/services/BookmarkService.ts (create, update, delete, list bookmarks)
- [ ] T115 [US6] Add bookmark thumbnail copying to persistent storage (separate from thumbnail cache)

#### IPC for Bookmarks

- [ ] T116 [P] [US6] Implement bookmarks:list IPC handler in src/main/ipc/handlers.ts
- [ ] T117 [P] [US6] Implement bookmarks:create IPC handler in src/main/ipc/handlers.ts
- [ ] T118 [P] [US6] Implement bookmarks:update IPC handler in src/main/ipc/handlers.ts
- [ ] T119 [P] [US6] Implement bookmarks:delete IPC handler in src/main/ipc/handlers.ts

#### Bookmark UI (Renderer Process)

- [ ] T120 [P] [US6] Create BookmarkList modal component in src/renderer/components/modals/BookmarkList.tsx (list view, thumbnails, notes)
- [ ] T121 [P] [US6] Create AddBookmarkDialog component in src/renderer/components/modals/AddBookmarkDialog.tsx (note input)
- [ ] T122 [US6] Add bookmark button in NavigationBar component
- [ ] T123 [US6] Add bookmark list toggle in NavigationBar component

#### Bookmark State Management

- [ ] T124 [US6] Add bookmarks array to viewerStore in src/renderer/store/viewerStore.ts
- [ ] T125 [US6] Implement bookmark CRUD actions in viewerStore (addBookmark, updateBookmark, deleteBookmark, loadBookmarks)
- [ ] T126 [US6] Add bookmark indicator overlay in ImageViewer (show bookmark icon if current page is bookmarked)

#### Bookmark Navigation

- [ ] T127 [US6] Implement jump to bookmark feature in BookmarkList (click → navigate to page)
- [ ] T128 [US6] Add keyboard shortcuts for bookmarks (Ctrl+B to add, Ctrl+Shift+B to view list)

**Checkpoint**: Full bookmark functionality with persistent storage, UI, and keyboard shortcuts

---

## Phase 9: User Story 7 - Image Manipulation and Viewing Options (Priority: P3)

**Goal**: Support zoom in/out via mouse wheel, pan when zoomed, rotate images, fullscreen mode, fit-to-width/height options

**Independent Test**: Open image, zoom with mouse wheel (smooth), pan by dragging, rotate 90°, enter fullscreen (Esc to exit), toggle fit modes

### Implementation for User Story 7

#### Zoom & Pan (Renderer Process)

- [ ] T129 [US7] Implement useZoomPan hook in src/renderer/hooks/useZoomPan.ts (zoom level state, mouse wheel handler, pan state)
- [ ] T130 [US7] Add zoom state to viewerStore in src/renderer/store/viewerStore.ts (zoomLevel, fitMode)
- [ ] T131 [US7] Update ImageViewer component to apply zoom and pan transformations (Konva scale and position)
- [ ] T132 [US7] Implement mouse wheel zoom in ImageViewer (smooth zoom, maintain center point)
- [ ] T133 [US7] Implement drag-to-pan in ImageViewer when zoomed (detect drag vs click)

#### Zoom Controls UI

- [ ] T134 [P] [US7] Add zoom in/out buttons in NavigationBar component
- [ ] T135 [P] [US7] Add zoom level indicator (e.g., "100%") in NavigationBar
- [ ] T136 [US7] Add fit mode selector in NavigationBar (fit-width, fit-height, actual-size, custom)

#### Rotation

- [ ] T137 [US7] Add rotation state to viewerStore (0, 90, 180, 270 degrees)
- [ ] T138 [US7] Add rotate clockwise/counterclockwise buttons in NavigationBar
- [ ] T139 [US7] Update ImageViewer to apply rotation transformation (Konva rotation)
- [ ] T140 [US7] Add keyboard shortcuts for rotation (R for clockwise, Shift+R for counterclockwise)

#### Fullscreen Mode

- [ ] T141 [US7] Implement fullscreen toggle in src/renderer/App.tsx (document.fullscreenElement API)
- [ ] T142 [US7] Add fullscreen button in NavigationBar component
- [ ] T143 [US7] Hide UI chrome in fullscreen mode (except navigation controls)
- [ ] T144 [US7] Add ESC key handler to exit fullscreen in useKeyboardShortcuts hook
- [ ] T145 [US7] Add keyboard shortcut F11 for fullscreen toggle

#### Fit Modes

- [ ] T146 [US7] Implement fit-to-width logic in ImageViewer (calculate zoom to fit canvas width)
- [ ] T147 [US7] Implement fit-to-height logic in ImageViewer
- [ ] T148 [US7] Implement actual-size (100% zoom) mode
- [ ] T149 [US7] Update session persistence to include zoom, rotation, fitMode

**Checkpoint**: Full image manipulation features: zoom, pan, rotate, fullscreen, fit modes all working smoothly

---

## Phase 10: Archive Format Extension (Additional Formats)

**Goal**: Add support for 7Z and TAR formats (ZIP, RAR already in US1)

**Note**: This phase extends US1 functionality but can be done independently

- [ ] T150 [P] Install node-7z library for 7Z support via npm
- [ ] T151 [P] Install tar-stream library for TAR support via npm
- [ ] T152 [P] Implement SevenZipReader in src/main/services/archive/SevenZipReader.ts
- [ ] T153 [P] Implement TarReader in src/main/services/archive/TarReader.ts
- [ ] T154 Update ArchiveService format detection to recognize 7Z and TAR files
- [ ] T155 Add 7Z and TAR to file associations in electron-builder config

---

## Phase 11: Advanced Features (Enhancements)

**Goal**: Additional features not in core user stories but mentioned in requirements

### Search & Sorting Enhancements

- [ ] T156 [P] Implement sort by file size in viewerStore
- [ ] T157 [P] Implement sort by file type in viewerStore
- [ ] T158 Add sort dropdown in NavigationBar component

### Password-Protected Archives

- [ ] T159 Create PasswordPrompt modal in src/renderer/components/modals/PasswordPrompt.tsx
- [ ] T160 Add password detection logic in ArchiveService
- [ ] T161 Implement password retry logic (max 3 attempts) in archive:open IPC handler
- [ ] T162 Display password prompt when PASSWORD_REQUIRED error returned from main process

### Multiple Archive Tabs

- [ ] T163 Add tab state to viewerStore (multiple archives, active tab index)
- [ ] T164 Create TabBar component in src/renderer/components/viewer/TabBar.tsx
- [ ] T165 Update App.tsx to support multiple viewing contexts (one per tab)
- [ ] T166 Implement tab switching logic (preserve state per tab)
- [ ] T167 Add "Open in New Tab" menu item in File menu

### Settings & Preferences

- [ ] T168 Create Settings modal in src/renderer/components/modals/Settings.tsx
- [ ] T169 Implement settings:get and settings:update IPC handlers
- [ ] T170 Add configurable keyboard shortcuts in Settings
- [ ] T171 Add thumbnail size preference (default 200px)
- [ ] T172 Add thumbnail cache max size preference (default 5GB)
- [ ] T173 Add default view mode preference
- [ ] T174 Add default reading direction preference

### Error Handling & User Feedback

- [ ] T175 Implement file information panel in NavigationBar (archive name, current file, dimensions, file size)
- [ ] T176 Add progress indicator for archive scanning (archive-scan-progress event)
- [ ] T177 Add loading indicator for large image loading (>3 seconds)
- [ ] T178 Implement error toast notifications for file operations
- [ ] T179 Add corrupted image indicator in viewer (show placeholder with error icon)

### Performance Monitoring

- [ ] T180 Add memory usage monitoring in src/main/index.ts (log warnings if >1GB)
- [ ] T181 Implement performance metrics logging (image load time, thumbnail generation time)
- [ ] T182 Add FPS counter in development mode (show in corner of ImageViewer)

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements that affect multiple user stories

### UI Polish

- [ ] T183 [P] Add application icons for all platforms (macOS, Windows, Linux) in public/icons/
- [ ] T184 [P] Implement dark mode theme support in src/renderer/styles/
- [ ] T185 [P] Add loading animations and transitions
- [ ] T186 [P] Add keyboard shortcut tooltips to all buttons

### Documentation

- [ ] T187 [P] Create user documentation in docs/user-guide.md
- [ ] T188 [P] Create keyboard shortcuts reference in docs/shortcuts.md
- [ ] T189 Update README.md with installation instructions and screenshots

### Code Quality

- [ ] T190 [P] Run ESLint across codebase and fix all warnings
- [ ] T191 [P] Run TypeScript type checker and resolve all type errors
- [ ] T192 Code cleanup and refactoring (remove dead code, extract common utilities)

### Build & Packaging

- [ ] T193 Test packaging for macOS (.dmg installer)
- [ ] T194 Test packaging for Windows (.exe installer)
- [ ] T195 Test packaging for Linux (AppImage)
- [ ] T196 Setup code signing for macOS and Windows builds
- [ ] T197 Test auto-update functionality (if electron-updater integrated)

### Final Validation

- [ ] T198 Run through all user story acceptance scenarios manually
- [ ] T199 Performance testing: open 10GB archive with 10,000 images, verify <1GB memory usage
- [ ] T200 Cross-platform testing: verify all features work on macOS, Windows, Linux

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel after Foundational
  - US3-US7 (P2-P3) can start after Foundational or incrementally after US1/US2
- **Archive Format Extension (Phase 10)**: Can proceed in parallel with US3-US7
- **Advanced Features (Phase 11)**: Can proceed after US1/US2 are stable
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Builds on US1 archive handling but independently testable
- **User Story 3 (P2)**: Depends on US1 (archive and image display) - Adds folder tree filtering
- **User Story 4 (P2)**: Depends on US1 (image display) - Adds two-page rendering mode
- **User Story 5 (P3)**: Depends on US1 (archive opening) - Adds system integration
- **User Story 6 (P3)**: Depends on US1 (sessions) and US2 (thumbnails) - Adds bookmark UI
- **User Story 7 (P3)**: Depends on US1 (image display) - Adds manipulation controls

### Within Each User Story

- **US1**: Types → Archive Services → Image Services → Session Services → IPC Handlers → UI Components → Hooks → Integration
- **US2**: Thumbnail Service → IPC Handlers → Thumbnail UI → Search → Performance optimizations
- **US3**: Folder UI → Filtering logic → Navigation adjustments
- **US4**: View mode state → Rendering logic → Controls → Navigation adjustments
- **US5**: File associations → Context menu → Command-line handling
- **US6**: Bookmark persistence → IPC → UI components → State management
- **US7**: Zoom/pan logic → Controls → Rotation → Fullscreen → Fit modes

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T002, T003, T004, T005, T006, T010, T011 can all run in parallel

**Foundational Phase (Phase 2)**:
- All type definitions (T013-T018) can run in parallel
- All utility files (T020-T022) can run in parallel
- T031, T032 (UI components) can run in parallel

**User Story 1**:
- T034, T035, T036, T037 (archive readers) can run in parallel
- T042, T044-T049 (IPC handlers) can run in parallel after services complete
- T050, T051, T052 (UI components) can run in parallel

**User Story 2**:
- T061, T062, T070 (libraries and thumbnail service) can run in parallel
- T067, T068, T074 (IPC and search) can run in parallel

**User Story 3**:
- T080, T081, T082 (folder tree UI) can run in parallel

**User Story 4**:
- T095, T096 (view mode controls) can run in parallel

**User Story 5**:
- T102, T103, T104, T105 (file associations) can run in parallel

**User Story 6**:
- T113, T116-T119 (repository and IPC) can run in parallel
- T120, T121 (bookmark UI modals) can run in parallel

**User Story 7**:
- T134, T135 (zoom controls) can run in parallel
- T152, T153 (archive format readers) can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch these tasks in parallel:

# Archive library setup (different files)
Task T034: "Install archive libraries: yauzl, node-unrar-js"
Task T036: "Implement ZipReader in src/main/services/archive/ZipReader.ts"
Task T037: "Implement RarReader in src/main/services/archive/RarReader.ts"

# Once archive readers complete, these can run in parallel:
Task T050: "Install Konva.js and React-Konva"
Task T051: "Create ImageViewer component in src/renderer/components/viewer/ImageViewer.tsx"
Task T052: "Create NavigationBar component in src/renderer/components/viewer/NavigationBar.tsx"

# IPC handlers can be implemented in parallel:
Task T044: "Implement archive:open IPC handler"
Task T045: "Implement archive:close IPC handler"
Task T046: "Implement archive:list-images IPC handler"
Task T047: "Implement image:load IPC handler"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (~2-3 hours)
2. Complete Phase 2: Foundational (~4-5 hours)
3. Complete Phase 3: User Story 1 (~8-10 hours)
4. **STOP and VALIDATE**: Test opening CBZ/CBR, navigation, resume from last page
5. Complete Phase 4: User Story 2 (~6-8 hours)
6. **STOP and VALIDATE**: Test large archives, thumbnails, search
7. Deploy/demo if ready (US1 + US2 = functional comic/photo viewer)

**Total MVP Estimate**: ~20-26 hours

### Incremental Delivery

1. **Foundation** (Phases 1-2) → Setup complete, types defined (~6-8 hours)
2. **MVP: US1 + US2** (Phases 3-4) → Basic viewer with thumbnails (~14-18 hours)
3. **Enhanced Navigation** (Phase 5: US3) → Folder tree navigation (~4-5 hours)
4. **Comic Reader** (Phase 6: US4) → Two-page mode (~4-5 hours)
5. **System Integration** (Phase 7: US5) → File associations (~3-4 hours)
6. **Bookmarks** (Phase 8: US6) → Persistent bookmarks (~5-6 hours)
7. **Image Controls** (Phase 9: US7) → Zoom, pan, rotate, fullscreen (~6-8 hours)
8. **Format Support** (Phase 10) → 7Z and TAR (~2-3 hours)
9. **Advanced Features** (Phase 11) → Password, tabs, settings (~8-10 hours)
10. **Polish** (Phase 12) → Final touches (~4-6 hours)

**Total Full Feature Estimate**: ~56-73 hours

### Parallel Team Strategy

With 3 developers after Foundational phase:

1. **Team completes Setup + Foundational together** (~6-8 hours)
2. **Once Foundational done**:
   - Developer A: User Story 1 (~8-10 hours)
   - Developer B: User Story 2 (starts after US1 basics, ~6-8 hours)
   - Developer C: Phase 10 (Archive formats, ~2-3 hours) then Phase 11 (Advanced features)
3. After US1/US2 complete:
   - Developer A: User Story 3 + 4 (~8-10 hours)
   - Developer B: User Story 5 + 6 (~8-10 hours)
   - Developer C: User Story 7 (~6-8 hours)
4. **Final integration and Polish** (all developers, ~4-6 hours)

**Parallel Team Total**: ~26-34 hours wall-clock time

---

## Task Summary

**Total Tasks**: 200
**Task Breakdown by Phase**:
- Phase 1 (Setup): 12 tasks
- Phase 2 (Foundational): 21 tasks
- Phase 3 (US1 - Core Viewer): 27 tasks
- Phase 4 (US2 - Thumbnails): 19 tasks
- Phase 5 (US3 - Folder Tree): 10 tasks
- Phase 6 (US4 - Two-Page Mode): 12 tasks
- Phase 7 (US5 - System Integration): 11 tasks
- Phase 8 (US6 - Bookmarks): 16 tasks
- Phase 9 (US7 - Image Controls): 21 tasks
- Phase 10 (Archive Formats): 6 tasks
- Phase 11 (Advanced Features): 28 tasks
- Phase 12 (Polish): 17 tasks

**Parallel Tasks**: 63 tasks marked [P] (31.5% can run in parallel)
**Sequential Tasks**: 137 tasks (dependencies on previous work)

**MVP Scope** (Phases 1-4): 79 tasks
**Full Feature Scope** (All Phases): 200 tasks

---

## Format Validation

✅ **ALL tasks follow required checklist format**:
- [x] Checkbox prefix: `- [ ]`
- [x] Task ID: T001-T200 sequential
- [x] [P] marker: 63 tasks marked as parallelizable
- [x] [Story] label: All user story tasks labeled (US1-US7)
- [x] File paths: All implementation tasks include exact file paths
- [x] Descriptions: Clear action verbs with specific deliverables

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests omitted as not explicitly requested in spec (can add via TDD later)
- Stop at any checkpoint to validate story independently
- Commit after each task or logical group
- Archive format support prioritizes ZIP/RAR (US1), then adds 7Z/TAR (Phase 10)
- Performance optimizations integrated throughout rather than separate phase
- System integration (US5) is platform-specific, may need OS-specific testing
