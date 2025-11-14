# MyViewer-electron Development Guidelines

**Last updated:** 2025-11-14

This document provides comprehensive guidelines for AI assistants working with the MyViewer-electron codebase.

## Project Overview

MyViewer is an Electron-based desktop application for viewing images from archive files (ZIP, CBZ, RAR, CBR, 7Z, TAR) and local folders. It provides features like thumbnail navigation, bookmarks, viewing sessions, zoom/pan controls, and customizable layouts.

**Tech Stack:**
- **Framework:** Electron 27.3.11 + TypeScript 5.9.3
- **UI:** React 18.3.1 with React Konva for canvas rendering
- **State Management:** Zustand 5.0.8
- **Database:** Better-sqlite3 12.4.1
- **Image Processing:** Sharp 0.34.5
- **Build Tools:** Vite 7.1.12, electron-builder

## Architecture Overview

### Process Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process (Node.js)                │
│  - Window Management (src/main/index.ts)                 │
│  - Services Layer (ArchiveService, ImageService, etc.)   │
│  - IPC Handlers (src/main/ipc/handlers.ts)              │
│  - Database (SQLite, src/main/db/)                      │
└────────────────┬────────────────────────────────────────┘
                 │ IPC Communication
                 │ (src/shared/constants/ipc-channels.ts)
┌────────────────┴────────────────────────────────────────┐
│              Renderer Process (React/Browser)            │
│  - React Components (src/renderer/components/)           │
│  - Zustand Store (src/renderer/store/viewerStore.ts)    │
│  - Custom Hooks (src/renderer/hooks/)                    │
│  - IPC Client (src/renderer/services/ipc.ts)            │
└─────────────────────────────────────────────────────────┘
```

### Project Structure

```
MyViewer-electron/
├── src/
│   ├── main/                      # Main process (Node.js)
│   │   ├── index.ts              # Entry point, window management
│   │   ├── preload.ts            # Context-isolated IPC bridge
│   │   ├── services/             # Business logic services
│   │   │   ├── ArchiveService.ts
│   │   │   ├── ImageService.ts
│   │   │   ├── ThumbnailService.ts
│   │   │   ├── FolderService.ts
│   │   │   ├── SessionService.ts
│   │   │   ├── RecentSourcesService.ts
│   │   │   └── archive/          # Archive readers (ZIP, RAR)
│   │   ├── ipc/
│   │   │   └── handlers.ts       # IPC handler registration
│   │   ├── db/
│   │   │   ├── init.ts           # Database setup & migrations
│   │   │   └── connection.ts     # SQLite connection
│   │   └── repositories/
│   │       └── SessionRepository.ts
│   ├── renderer/                  # Renderer process (React)
│   │   ├── index.tsx             # React root
│   │   ├── App.tsx               # Main application component
│   │   ├── components/
│   │   │   ├── viewer/           # Main viewer components
│   │   │   └── shared/           # Reusable components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── services/
│   │   │   └── ipc.ts            # IPC client wrapper
│   │   └── store/
│   │       └── viewerStore.ts    # Zustand state management
│   ├── shared/                    # Shared between main & renderer
│   │   ├── types/                # TypeScript interfaces
│   │   └── constants/            # Constants (IPC channels, etc.)
│   └── lib/                       # Utility libraries
│       ├── file-utils.ts         # File path utilities
│       ├── image-utils.ts        # Image format detection
│       └── natural-sort.ts       # Natural sorting algorithm
├── config/
│   ├── electron-builder.yml      # Electron builder config
│   ├── eslint.config.js          # ESLint configuration
│   └── .prettierrc               # Prettier configuration
├── dist/                          # Build output
├── package.json
├── tsconfig.json                  # Base TypeScript config
├── tsconfig.main.json            # Main process config
├── tsconfig.renderer.json        # Renderer process config
└── vite.config.ts                # Vite build configuration
```

## Key Components & Files

### Main Process

**Entry Point:** `src/main/index.ts` (255 lines)
- Creates and manages the BrowserWindow
- Sets up application menu (File/View)
- Handles single-instance lock
- Initializes database and IPC handlers
- Supports drag-and-drop file opening

**Preload Script:** `src/main/preload.ts`
- Exposes safe IPC API to renderer via `window.electronAPI`
- Methods: `invoke()`, `send()`, `on()`, `removeAllListeners()`

**IPC Handlers:** `src/main/ipc/handlers.ts`
- Centralized handler registry with error wrapping
- 20+ channels for archive, folder, image, session, bookmark operations
- See `src/shared/constants/ipc-channels.ts` for channel definitions

### Services Layer

**ArchiveService** (`src/main/services/ArchiveService.ts`, 290 lines)
- Opens/closes archives (ZIP, RAR)
- Builds folder tree from archive structure
- Manages open archives in memory
- Key methods: `openArchive()`, `closeArchive()`, `getArchive()`, `buildFolderTree()`

**ImageService** (`src/main/services/ImageService.ts`, 110 lines)
- Loads full-resolution images from archives
- Converts images to Base64 for IPC transmission

**ThumbnailService** (`src/main/services/ThumbnailService.ts`, 156 lines)
- Generates thumbnails using Sharp (220x165px default)
- Disk cache with SHA1 hash-based naming
- In-flight request deduplication
- Cache location: `{userData}/thumbnail-cache/`

**FolderService** (`src/main/services/FolderService.ts`, 207 lines)
- Scans folders recursively for images
- Builds folder tree structure
- Path validation to prevent traversal attacks

**SessionService** (`src/main/services/SessionService.ts`, 140 lines)
- Manages viewing sessions (SQLite storage)
- Auto-resume functionality
- Updates session state (page, zoom, view mode, etc.)

### Renderer Components

**Main App:** `src/renderer/App.tsx`
- Layout: Header → Navigation → Sidebar + Viewer + Bottom Thumbnails
- Drag & drop support
- Fullscreen mode
- Error boundary for crash prevention

**Key Components:**
- **ImageViewer.tsx** (376 lines) - Konva canvas for zoom/pan/rotation
- **NavigationBar.tsx** (361 lines) - Page controls, keyboard shortcuts
- **FolderSidebar.tsx** (316 lines) - Expandable folder tree
- **BottomThumbnails.tsx** (282 lines) - Thumbnail strip (alternative to sidebar)

**Custom Hooks:**
- **useArchive** - Archive/folder opening logic
- **useImageNavigation** - Page navigation (next, prev, goto)
- **useKeyboardShortcuts** - Global keyboard event handling
- **useInViewport** - Lazy loading detection

### State Management

**Zustand Store:** `src/renderer/store/viewerStore.ts`

Key state:
```typescript
{
  // Source & Navigation
  currentSource: SourceDescriptor | null
  images: Image[]
  currentPageIndex: number

  // View Settings
  viewMode: 'SINGLE' | 'TWO_PAGE'
  zoomLevel: number (0.1 - 10.0)
  fitMode: 'FIT_WIDTH' | 'FIT_HEIGHT' | 'ACTUAL_SIZE' | 'CUSTOM'
  rotation: 0 | 90 | 180 | 270
  readingDirection: 'LTR' | 'RTL'

  // UI State
  isFullscreen: boolean
  showThumbnails: boolean
  showFolderTree: boolean
  thumbnailPosition: 'sidebar' | 'bottom'
  sidebarWidth: number (180-500px)

  // Data
  bookmarks: Bookmark[]
  recentSources: SourceDescriptor[]
}
```

### Shared Types

**Key Interfaces** (in `src/shared/types/`):

- **Image** - Image metadata (id, path, format, dimensions, etc.)
- **Archive** - Archive metadata (format, file count, folder tree)
- **FolderNode** - Folder tree node (children, images, counts)
- **ViewingSession** - Session state (page, zoom, view settings)
- **Bookmark** - Bookmark record (archive path, image path)
- **SourceDescriptor** - Source reference (type, path, label)

**Supported Formats:**
- Images: JPEG, PNG, GIF, BMP, TIFF, WebP, PSD, SVG
- Archives: ZIP, CBZ, RAR, CBR, 7Z, TAR

### Utilities

**file-utils.ts** (97 lines) - SECURITY CRITICAL
- `sanitizePath()` - Prevents path traversal attacks
- `validatePath()` - Validates file paths
- `isPathWithinBase()` - Ensures path is within base directory
- **Always use these utilities when handling file paths!**

**image-utils.ts** (171 lines)
- `detectFormatFromExtension()` - File extension → ImageFormat
- `detectFormatFromMagicBytes()` - Magic bytes → ImageFormat
- `isSupportedImageFormat()` - Validation
- `isDoublePageSpread()` - Aspect ratio detection

**natural-sort.ts**
- Natural sorting for images/folders (1, 2, 10 vs 1, 10, 2)

## Development Workflows

### Setup & Running

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build for production
npm run build

# Create installers
npm run package              # All platforms
npm run package:mac          # macOS only
npm run package:win          # Windows only
npm run package:linux        # Linux only
```

### Code Quality

```bash
# Linting
npm run lint                 # Check for issues
npm run lint:fix             # Auto-fix issues

# Formatting
npm run format               # Run Prettier

# Type checking
npm run type-check           # TypeScript validation
```

### Testing

```bash
npm test                     # Tests not yet implemented
```

## Coding Conventions

### TypeScript

**Configuration:**
- Target: ES2020
- Module: CommonJS (main), ESNext (renderer)
- Strict mode enabled
- Path aliases: `@main/*`, `@renderer/*`, `@shared/*`, `@lib/*`

**Style Guidelines:**
- Use interfaces over types where possible
- Prefer explicit return types for public functions
- Use `unknown` instead of `any` (warn level for any)
- Prefix unused variables with `_`

### ESLint Rules

**Key Rules:**
- `@typescript-eslint/explicit-module-boundary-types`: off
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: warn (except `_` prefixed)
- `react/react-in-jsx-scope`: off (React 18+)
- `react/prop-types`: off (using TypeScript)

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

**Code Style:**
- Use single quotes for strings
- Always use semicolons
- 100 character line limit
- 2 space indentation
- LF line endings
- Arrow function parens: avoid when possible

### React Patterns

**Component Structure:**
```typescript
// Prefer functional components with hooks
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  // Zustand hooks at top
  const state = useViewerStore(state => state.value);

  // Custom hooks
  const { method } = useCustomHook();

  // Event handlers
  const handleClick = () => { ... };

  // Render
  return <div>...</div>;
};
```

**State Management:**
- Use Zustand for global state
- Use React state for local component state
- Keep state minimal and derived when possible

### IPC Communication

**Adding New IPC Channels:**

1. Define channel in `src/shared/constants/ipc-channels.ts`:
```typescript
export const IPC_CHANNELS = {
  MY_NEW_CHANNEL: 'my-new-channel',
};
```

2. Implement handler in `src/main/ipc/handlers.ts`:
```typescript
registry.register('my-new-channel', async (event, data) => {
  // Implementation
  return result;
});
```

3. Add client method in `src/renderer/services/ipc.ts`:
```typescript
async myNewMethod(data: MyData): Promise<Result> {
  return this.invoke('my-new-channel', data);
}
```

4. Use in components:
```typescript
const result = await ipcService.myNewMethod(data);
```

### Error Handling

**Main Process:**
- Wrap IPC handlers with error handling
- Log errors to console
- Return user-friendly error messages

**Renderer Process:**
- Use ErrorBoundary for React errors
- Display user-friendly error messages in UI
- Clear error state appropriately

**Example:**
```typescript
try {
  const result = await ipcService.openArchive(path);
  // Handle success
} catch (error) {
  console.error('Failed to open archive:', error);
  setError('Could not open archive. Please check the file.');
}
```

### Security Best Practices

**Critical Security Requirements:**

1. **Path Validation:**
   - ALWAYS use `sanitizePath()` and `validatePath()` from `@lib/file-utils`
   - Never trust user-provided paths
   - Check paths are within expected directories

2. **Context Isolation:**
   - Keep context isolation enabled
   - Only expose necessary APIs via preload
   - Never enable `nodeIntegration` in renderer

3. **IPC Security:**
   - Validate all IPC inputs
   - Sanitize file paths
   - Check permissions before file operations

4. **Data Validation:**
   - Validate image formats using magic bytes
   - Check file sizes before processing
   - Sanitize user inputs

### Database

**Schema:**
- `bookmarks` - User bookmarks (archive_path, image_path, created_at)
- `viewing_sessions` - Session state (source_path, page_index, settings, timestamps)

**Migrations:**
- Location: `src/main/db/migrations/`
- Automatic execution on app start
- Versioned migration files

**Usage:**
```typescript
// Use SessionRepository for database operations
const session = await sessionRepository.getOrCreateSession(sourcePath);
await sessionRepository.updateSession(sessionId, updates);
```

## Build Configuration

### Vite Configuration (`vite.config.ts`)

**Aliases:**
- `@main` → `src/main`
- `@renderer` → `src/renderer`
- `@shared` → `src/shared`
- `@lib` → `src/lib`

**Output:**
- Main process: `dist/main` (CommonJS)
- Renderer: `dist/renderer` (ES modules)

**Externals:**
- electron, better-sqlite3, sharp, yauzl, node-7z

### Electron Builder (`config/electron-builder.yml`)

**App ID:** com.myviewer.app

**Platforms:**
- macOS: DMG, ZIP
- Windows: NSIS, Portable
- Linux: AppImage, DEB

**File Associations:**
- .zip, .cbz, .rar, .cbr, .7z, .tar

## Performance Considerations

### Optimization Strategies

1. **Thumbnail Caching:**
   - Disk-based cache with SHA1 keys
   - In-flight request deduplication
   - WebP format for smaller file sizes

2. **Lazy Loading:**
   - Images loaded on-demand via IPC
   - Thumbnail loading based on viewport
   - Use `useInViewport` hook for detection

3. **Canvas Rendering:**
   - Konva for GPU-accelerated rendering
   - Efficient zoom/pan with transform matrix
   - Image recycling for memory management

4. **Natural Sorting:**
   - Pre-computed sort keys where possible
   - Efficient string comparison algorithm

### Memory Management

- Close archives when switching sources
- Clear image buffers after transmission
- Limit concurrent thumbnail generation
- Use weak references for caches where appropriate

## Recent Development Focus

Based on git history (last 5 commits):
1. **Thumbnail Performance Pipeline** - Optimization improvements
2. **Bottom Thumbnail Strip** - Alternative to sidebar thumbnails
3. **Viewer Sizing Adjustments** - Layout for bottom thumbnails
4. **Thumbnail Aspect Ratio** - Locked to 4x3 aspect ratio

## Common Development Tasks

### Adding a New Feature

1. **Plan the feature:**
   - Identify main/renderer changes needed
   - Plan IPC communication if required
   - Consider state management needs

2. **Implement main process changes:**
   - Add/update services
   - Create IPC handlers
   - Update types in `@shared/types`

3. **Implement renderer changes:**
   - Update Zustand store if needed
   - Create/update components
   - Add IPC client methods

4. **Test thoroughly:**
   - Manual testing in dev mode
   - Check error cases
   - Test with various file types

5. **Code quality:**
   - Run linter: `npm run lint:fix`
   - Format code: `npm run format`
   - Type check: `npm run type-check`

### Debugging

**Main Process:**
- Add `console.log()` statements
- Logs appear in terminal running `npm run dev`
- Use electron dev tools (Help → Toggle Developer Tools)

**Renderer Process:**
- Use React DevTools
- Browser console in Electron window (View → Toggle Developer Tools)
- Zustand DevTools for state debugging

**IPC Communication:**
- Log in both handler and client
- Check channel names match exactly
- Verify data serialization

## Important Reminders

### Do's

- ✅ Use path aliases (`@main/*`, `@renderer/*`, etc.)
- ✅ Sanitize all file paths with utilities
- ✅ Follow TypeScript strict mode
- ✅ Use Zustand for global state
- ✅ Implement error handling
- ✅ Follow Prettier formatting
- ✅ Update CLAUDE.md when architecture changes

### Don'ts

- ❌ Don't enable `nodeIntegration` in renderer
- ❌ Don't trust user-provided paths without validation
- ❌ Don't use `any` type (use `unknown` or specific types)
- ❌ Don't disable security features without good reason
- ❌ Don't bypass ESLint rules without justification
- ❌ Don't commit without running linter

## Troubleshooting

### Common Issues

**Issue:** TypeScript path alias not resolving
- **Solution:** Check `tsconfig.json` paths match vite.config.ts aliases

**Issue:** Native modules not loading (sharp, sqlite3)
- **Solution:** Rebuild native modules: `npm rebuild`

**Issue:** IPC handler not responding
- **Solution:** Check handler registration in `src/main/ipc/handlers.ts`

**Issue:** Images not loading
- **Solution:** Verify archive is still open, check path sanitization

**Issue:** Build fails
- **Solution:** Clear `dist/` and rebuild: `rm -rf dist && npm run build`

## Resources

- **Electron Documentation:** https://www.electronjs.org/docs
- **React Documentation:** https://react.dev
- **Zustand Documentation:** https://docs.pmnd.rs/zustand
- **TypeScript Documentation:** https://www.typescriptlang.org/docs

---

**Note:** This document should be updated whenever significant architectural changes are made to the project. Last major update focused on thumbnail performance and bottom thumbnail strip feature.
