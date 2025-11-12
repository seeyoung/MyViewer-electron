# Implementation Plan: Archive-Based Image Viewer

**Branch**: `001-archive-image-viewer` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-archive-image-viewer/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a desktop image viewer application that opens and displays images from compressed archive files (ZIP, RAR, 7Z, TAR, CBZ, CBR) without extracting them to disk. The application must support real-time browsing of large archives (up to 10GB with 10,000+ images), generate thumbnails for quick navigation, maintain smooth 60fps performance, and provide comic book reading features including two-page spread mode, bookmarks, and resume-from-last-page functionality.

## Technical Context

**Language/Version**: Electron + TypeScript (Node.js 18+, TypeScript 5.0+)
**Primary Dependencies**:
- Archive handling: node-libarchive, node-unrar, yauzl (ZIP), node-7z
- Image processing: sharp (thumbnails), canvas/Konva.js (rendering)
- UI framework: React 18+, Electron 27+
- State management: Zustand or Jotai (lightweight state)
- Database: better-sqlite3 (bookmarks/session persistence)

**Storage**: Local SQLite database for bookmarks and session state, filesystem cache for thumbnails
**Testing**: Jest + React Testing Library (unit), Playwright (E2E), Spectron (Electron integration)
**Target Platform**: macOS 10.15+, Windows 10+, Linux (Ubuntu 20.04+) desktop applications
**Project Type**: Desktop application (Electron) with main process (Node.js) and renderer process (React)

**Performance Goals**:
- Archive opening: <3 seconds for 500MB files
- Thumbnail generation: 100 images in <10 seconds
- Navigation response: <200ms per page turn
- UI rendering: 60fps for zoom/pan operations
- Memory usage: <1GB for 10,000+ image archives

**Constraints**:
- No extraction to temporary directories (stream images directly from archives)
- Support archives up to 10GB without memory exhaustion
- Cross-platform system integration (file associations, context menus)
- Offline-capable (no cloud dependencies)

**Scale/Scope**:
- Support 10,000+ images per archive
- 6 archive formats (ZIP, RAR, 7Z, TAR, CBZ, CBR)
- 7+ image formats (JPEG, PNG, GIF, BMP, TIFF, WebP, PSD)
- ~15 main UI screens/panels (viewer, thumbnails, folder tree, bookmarks, settings)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: No constitution file found (default template). Using standard best practices:

### Standard Practices Applied

✅ **Library-First Approach**: Archive handling, image processing, and state management will use well-established libraries
- Archive parsing abstracted into service layer
- Image rendering abstracted into component layer
- Database operations abstracted into repository pattern

✅ **Testing Strategy**: TDD approach for core services
- Unit tests for archive parsing, image loading, bookmark management
- Integration tests for IPC (Inter-Process Communication) between Electron main/renderer
- E2E tests for user workflows (open archive, navigate, bookmark, resume)

✅ **Observability**: Structured logging for debugging
- Main process logs for archive operations
- Renderer process logs for UI interactions
- Performance monitoring for memory/CPU usage

✅ **Simplicity First**: Start with essential features
- Phase 1: Basic archive viewing (P1 user stories)
- Phase 2: Enhanced navigation (P2 user stories)
- Phase 3: System integration and polish (P3 user stories)

### Architecture Decisions

**Electron Multi-Process Architecture**:
- **Main Process**: Archive I/O, file system access, system integration
- **Renderer Process**: React UI, image rendering, user interactions
- **IPC Bridge**: Message passing for archive data, image buffers

**Justification**: Desktop application requires native file system access and system integration (context menus), which browser-based solutions cannot provide. Electron provides cross-platform compatibility while allowing web technology stack.

## Project Structure

### Documentation (this feature)

```text
specs/001-archive-image-viewer/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── ipc-api.yaml     # Electron IPC contracts (main <-> renderer)
│   └── models.yaml      # Data models and entities
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Electron application structure
src/
├── main/                    # Electron main process (Node.js)
│   ├── services/
│   │   ├── ArchiveService.ts      # Archive reading/parsing
│   │   ├── ImageService.ts        # Image extraction/loading
│   │   ├── ThumbnailService.ts    # Thumbnail generation/caching
│   │   ├── BookmarkService.ts     # Bookmark persistence
│   │   └── SessionService.ts      # Session state management
│   ├── repositories/
│   │   ├── BookmarkRepository.ts  # SQLite bookmark storage
│   │   └── SessionRepository.ts   # SQLite session storage
│   ├── ipc/
│   │   └── handlers.ts            # IPC message handlers
│   └── index.ts                   # Main process entry point
│
├── renderer/                # Electron renderer process (React)
│   ├── components/
│   │   ├── viewer/
│   │   │   ├── ImageViewer.tsx    # Main image display component
│   │   │   ├── ThumbnailGrid.tsx  # Thumbnail panel
│   │   │   ├── FolderTree.tsx     # Folder navigation tree
│   │   │   └── NavigationBar.tsx  # Page navigation controls
│   │   ├── modals/
│   │   │   ├── BookmarkList.tsx   # Bookmark manager
│   │   │   └── PasswordPrompt.tsx # Password input for protected archives
│   │   └── shared/
│   │       ├── LoadingIndicator.tsx
│   │       └── ErrorBoundary.tsx
│   ├── hooks/
│   │   ├── useArchive.ts          # Archive state management
│   │   ├── useImageNavigation.ts  # Page navigation logic
│   │   ├── useKeyboardShortcuts.ts # Keyboard event handling
│   │   └── useZoomPan.ts          # Zoom/pan state management
│   ├── services/
│   │   └── ipc.ts                 # IPC client wrapper
│   ├── store/
│   │   └── viewerStore.ts         # Zustand state management
│   └── index.tsx                  # Renderer entry point
│
├── shared/                  # Shared types between main/renderer
│   ├── types/
│   │   ├── Archive.ts       # Archive-related types
│   │   ├── Image.ts         # Image-related types
│   │   ├── Bookmark.ts      # Bookmark types
│   │   └── ViewingSession.ts # Session types
│   └── constants/
│       └── ipc-channels.ts  # IPC channel names (prevent typos)
│
└── lib/                     # Shared utilities
    ├── natural-sort.ts      # Natural alphanumeric sorting
    ├── image-utils.ts       # Image format detection
    └── file-utils.ts        # File path handling

tests/
├── unit/
│   ├── main/
│   │   ├── services/
│   │   │   ├── ArchiveService.test.ts
│   │   │   ├── ThumbnailService.test.ts
│   │   │   └── BookmarkService.test.ts
│   │   └── repositories/
│   │       └── BookmarkRepository.test.ts
│   └── renderer/
│       ├── components/
│       │   └── ImageViewer.test.tsx
│       └── hooks/
│           └── useImageNavigation.test.ts
├── integration/
│   ├── ipc-communication.test.ts
│   └── archive-to-display.test.ts
└── e2e/
    ├── open-and-navigate.spec.ts
    ├── bookmark-workflow.spec.ts
    └── two-page-mode.spec.ts

public/                      # Static assets
├── icons/                   # Application icons
└── index.html               # Main HTML file

config/
├── electron-builder.yml     # Build/packaging configuration
└── tsconfig.json            # TypeScript configuration
```

**Structure Decision**: Electron multi-process architecture selected because:
1. **Desktop Requirements**: Need native file system access for large archives (no browser security restrictions)
2. **Performance**: Main process handles heavy I/O operations while renderer stays responsive
3. **Cross-Platform**: Single codebase targets macOS, Windows, Linux
4. **Modern Stack**: React + TypeScript provides productive development with type safety

## Complexity Tracking

No constitution violations requiring justification.

**Architectural Complexity Justified**:

| Design Choice | Why Needed | Simpler Alternative Rejected Because |
|---------------|------------|-------------------------------------|
| Electron multi-process | Desktop app needs file system access, system integration (context menus), and ability to handle 10GB files | Web app cannot access local file system with required performance; native apps require 3 separate codebases |
| IPC communication layer | Main process must handle I/O while renderer stays responsive | Single-process would block UI during archive operations (violates <200ms navigation requirement) |
| SQLite database | Persist bookmarks and session state across app restarts | JSON files would require full file read/write on every change; localStorage unavailable in main process |
| Service layer abstraction | Support 6 different archive formats with consistent interface | Direct library usage would spread format-specific logic throughout codebase |
| Repository pattern for database | Isolate database implementation from business logic | Direct SQL in services would make testing harder and violate separation of concerns |

These complexities are **justified by requirements**:
- Multi-GB file handling requires native file system APIs
- Sub-200ms navigation requires background processing
- System integration (context menus) requires desktop platform
- Cross-platform requirement makes Electron cost-effective vs. 3 native codebases
