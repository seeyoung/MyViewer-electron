# Developer Quickstart Guide

**Feature**: Archive-Based Image Viewer
**Date**: 2025-10-28
**Target Audience**: Developers setting up local development environment

## Prerequisites

- **Node.js**: 18.x or higher ([Download](https://nodejs.org/))
- **npm**: 9.x or higher (comes with Node.js)
- **Git**: For version control
- **Code Editor**: VS Code recommended (with TypeScript extensions)
- **Platform-Specific**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Visual Studio Build Tools or Windows SDK
  - **Linux**: `build-essential`, `libsqlite3-dev`

## Project Setup

### 1. Clone Repository and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd myViewer-claude

# Install dependencies
npm install

# Install Electron-specific build tools
npm install --save-dev electron-rebuild
npx electron-rebuild

# Verify installation
npm run check
```

### 2. Project Structure

```
myViewer-claude/
├── src/
│   ├── main/          # Electron main process (Node.js)
│   ├── renderer/      # React app (Electron renderer)
│   └── shared/        # Shared TypeScript types
├── tests/             # Unit, integration, E2E tests
├── public/            # Static assets
├── config/            # Build configuration
├── specs/             # Feature specifications
└── package.json
```

### 3. Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Run main process only (for debugging)
npm run dev:main

# Run renderer only (for UI development)
npm run dev:renderer

# Run TypeScript type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end tests

# Build for production
npm run build

# Package for distribution
npm run package:mac        # macOS DMG
npm run package:win        # Windows installer
npm run package:linux      # Linux AppImage
```

## Development Workflow

### Hot Reload Development

**Terminal 1 - Main Process**:
```bash
npm run dev:main
# Watches: src/main/**/*.ts
# Auto-restarts Electron on changes
```

**Terminal 2 - Renderer Process**:
```bash
npm run dev:renderer
# Watches: src/renderer/**/*.tsx
# Hot Module Replacement (HMR)
```

**Or run both together**:
```bash
npm run dev
# Starts both main and renderer processes
# Opens Electron window automatically
```

### Making Code Changes

1. **Main Process** (`src/main/`):
   - Edit TypeScript files
   - Save → main process auto-restarts
   - Electron window reloads automatically

2. **Renderer Process** (`src/renderer/`):
   - Edit React components
   - Save → HMR applies changes instantly
   - No window reload needed

3. **Shared Types** (`src/shared/types/`):
   - Changes affect both processes
   - Triggers rebuild of both main and renderer

### Testing Changes

```bash
# After making changes, run tests
npm run test:unit

# Run specific test file
npm test -- ArchiveService.test.ts

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Check code coverage
npm run test:coverage
```

## Key Technologies

| Technology | Purpose | Documentation |
|------------|---------|---------------|
| **Electron** | Desktop app framework | [electronjs.org](https://www.electronjs.org/) |
| **TypeScript** | Type-safe JavaScript | [typescriptlang.org](https://www.typescriptlang.org/) |
| **React** | UI library | [react.dev](https://react.dev/) |
| **Zustand** | State management | [zustand](https://github.com/pmndrs/zustand) |
| **sharp** | Image processing | [sharp](https://sharp.pixelplumbing.com/) |
| **better-sqlite3** | SQLite database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| **yauzl** | ZIP reading | [yauzl](https://github.com/thejoshwolfe/yauzl) |
| **Konva.js** | Canvas rendering | [konvajs.org](https://konvajs.org/) |

## Architecture Overview

### Electron Multi-Process

```
┌─────────────────────────────────────────────────────┐
│                  Main Process                       │
│  (Node.js - File I/O, Archive Handling, Database)  │
│                                                     │
│  - ArchiveService      - BookmarkService           │
│  - ImageService        - SessionService            │
│  - ThumbnailService    - IPC Handlers              │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ IPC (Inter-Process Communication)
                   │
┌──────────────────▼──────────────────────────────────┐
│                Renderer Process                     │
│        (React - UI, User Interactions)              │
│                                                     │
│  - ImageViewer         - ThumbnailGrid             │
│  - NavigationBar       - FolderTree                │
│  - BookmarkList        - ViewerStore (Zustand)     │
└─────────────────────────────────────────────────────┘
```

### IPC Communication Pattern

**Renderer → Main (Invoke)**:
```typescript
// renderer/services/ipc.ts
const result = await ipcRenderer.invoke('archive:open', {
  filePath: '/path/to/archive.cbz'
})
```

**Main → Renderer (Handle)**:
```typescript
// main/ipc/handlers.ts
ipcMain.handle('archive:open', async (event, { filePath }) => {
  const archive = await archiveService.open(filePath)
  return archive
})
```

**Main → Renderer (Event)**:
```typescript
// main/services/ThumbnailService.ts
mainWindow.webContents.send('thumbnail:generated', thumbnail)

// renderer/hooks/useThumbnails.ts
useEffect(() => {
  ipcRenderer.on('thumbnail:generated', (event, thumbnail) => {
    updateThumbnailInStore(thumbnail)
  })
}, [])
```

## Common Development Tasks

### 1. Opening an Archive

**Main Process** (`src/main/services/ArchiveService.ts`):
```typescript
async openArchive(filePath: string, password?: string): Promise<Archive> {
  // 1. Detect format from extension and magic bytes
  const format = await this.detectFormat(filePath)

  // 2. Open archive using format-specific library
  const reader = this.getReader(format)
  const handle = await reader.open(filePath, password)

  // 3. List all entries
  const entries = await reader.listEntries(handle)

  // 4. Filter for images, build folder tree
  const images = this.filterImages(entries)
  const folderTree = this.buildFolderTree(images)

  // 5. Create Archive entity
  const archive: Archive = {
    id: uuid(),
    filePath,
    format,
    totalImageCount: images.length,
    rootFolder: folderTree,
    // ... more properties
  }

  return archive
}
```

**Renderer** (`src/renderer/hooks/useArchive.ts`):
```typescript
const openArchive = async (filePath: string) => {
  try {
    setLoading(true)

    // Call main process via IPC
    const archive = await ipc.invoke('archive:open', { filePath })

    // Update Zustand store
    viewerStore.setState({ currentArchive: archive })

    // Load first page
    await navigateToPage(0)
  } catch (error) {
    showError(error.message)
  } finally {
    setLoading(false)
  }
}
```

### 2. Displaying an Image

**Main Process** (`src/main/services/ImageService.ts`):
```typescript
async loadImage(archiveId: string, imageId: string): Promise<Buffer> {
  const archive = this.archiveCache.get(archiveId)
  const image = archive.images.find(i => i.id === imageId)

  // Extract image from archive (streaming)
  const buffer = await this.archiveService.extractEntry(
    archive,
    image.pathInArchive
  )

  return buffer
}
```

**Renderer** (`src/renderer/components/viewer/ImageViewer.tsx`):
```typescript
const ImageViewer: React.FC = () => {
  const [imageData, setImageData] = useState<string | null>(null)
  const currentImage = viewerStore(state => state.currentImage)

  useEffect(() => {
    const loadImage = async () => {
      const { data } = await ipc.invoke('image:load', {
        archiveId: currentImage.archiveId,
        imageId: currentImage.id,
        encoding: 'base64'
      })

      setImageData(`data:image/jpeg;base64,${data}`)
    }

    loadImage()
  }, [currentImage.id])

  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
        <ImageComponent image={imageData} />
      </Layer>
    </Stage>
  )
}
```

### 3. Generating Thumbnails

**Main Process** (`src/main/services/ThumbnailService.ts`):
```typescript
async generateThumbnail(imageBuffer: Buffer, size: number): Promise<string> {
  const cacheKey = this.computeCacheKey(imageBuffer, size)
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.jpg`)

  // Check if already cached
  if (await fs.pathExists(cachePath)) {
    return cachePath
  }

  // Generate with sharp
  await sharp(imageBuffer)
    .resize(size, size, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(cachePath)

  return cachePath
}
```

### 4. Adding a Bookmark

**Main Process** (`src/main/repositories/BookmarkRepository.ts`):
```typescript
createBookmark(bookmark: Bookmark): Bookmark {
  const stmt = this.db.prepare(`
    INSERT INTO bookmarks (id, archive_path, page_index, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    bookmark.id,
    bookmark.archivePath,
    bookmark.pageIndex,
    bookmark.note,
    bookmark.createdAt,
    bookmark.updatedAt
  )

  return bookmark
}
```

**Renderer** (`src/renderer/components/modals/BookmarkList.tsx`):
```typescript
const addBookmark = async (note: string) => {
  const currentPage = viewerStore.getState().currentPageIndex
  const archivePath = viewerStore.getState().currentArchive.filePath

  const bookmark = await ipc.invoke('bookmarks:create', {
    archivePath,
    pageIndex: currentPage,
    note
  })

  viewerStore.setState(state => ({
    bookmarks: [...state.bookmarks, bookmark]
  }))
}
```

## Debugging

### Chrome DevTools

**Open DevTools**:
```typescript
// In main process
mainWindow.webContents.openDevTools()

// Or use keyboard shortcut in app:
// macOS: Cmd+Option+I
// Windows/Linux: Ctrl+Shift+I
```

**Main Process Debugging**:
```bash
# Launch with Node.js debugging enabled
npm run dev:debug

# Open chrome://inspect in Chrome
# Click "Open dedicated DevTools for Node"
```

### VS Code Debugging

**`.vscode/launch.json`**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "args": [".", "--remote-debugging-port=9223"],
      "outputCapture": "std"
    },
    {
      "name": "Electron: Renderer",
      "type": "chrome",
      "request": "attach",
      "port": 9223,
      "webRoot": "${workspaceFolder}/src/renderer"
    }
  ],
  "compounds": [
    {
      "name": "Electron: All",
      "configurations": ["Electron: Main", "Electron: Renderer"]
    }
  ]
}
```

### Logging

**Structured Logging**:
```typescript
// Use electron-log for persistent logs
import log from 'electron-log'

log.info('Archive opened', { archiveId, fileSize })
log.error('Failed to load image', { imageId, error: err.message })

// Logs saved to:
// macOS: ~/Library/Logs/myViewer/main.log
// Windows: %USERPROFILE%\AppData\Roaming\myViewer\logs\main.log
// Linux: ~/.config/myViewer/logs/main.log
```

## Performance Profiling

### React DevTools Profiler

1. Install React DevTools Chrome extension
2. Open DevTools → Profiler tab
3. Click Record → interact with app → Stop
4. Analyze component render times

### Electron Performance Monitor

```typescript
// In main process
app.whenReady().then(() => {
  const { powerMonitor } = require('electron')

  powerMonitor.on('suspend', () => {
    log.info('System suspended')
  })

  powerMonitor.on('resume', () => {
    log.info('System resumed')
  })
})
```

### Memory Profiling

```bash
# Launch with memory profiling
npm run dev -- --js-flags="--expose-gc --max-old-space-size=4096"
```

**In Chrome DevTools**:
- Memory tab → Take heap snapshot
- Compare snapshots to find memory leaks

## Testing

### Unit Tests (Jest)

**Test Example** (`tests/unit/main/services/ArchiveService.test.ts`):
```typescript
import { ArchiveService } from '@main/services/ArchiveService'

describe('ArchiveService', () => {
  let archiveService: ArchiveService

  beforeEach(() => {
    archiveService = new ArchiveService()
  })

  it('should open a ZIP archive', async () => {
    const archive = await archiveService.open('test-fixtures/comic.cbz')

    expect(archive.format).toBe('cbz')
    expect(archive.totalImageCount).toBeGreaterThan(0)
  })

  it('should detect password-protected archives', async () => {
    await expect(
      archiveService.open('test-fixtures/encrypted.zip')
    ).rejects.toThrow('PASSWORD_REQUIRED')
  })
})
```

**Run Tests**:
```bash
npm run test:unit
npm run test:coverage  # With coverage report
```

### E2E Tests (Playwright)

**Test Example** (`tests/e2e/open-and-navigate.spec.ts`):
```typescript
import { test, expect } from '@playwright/test'
import { ElectronApplication, _electron as electron } from 'playwright'

test.describe('Archive Navigation', () => {
  let app: ElectronApplication

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('should open archive and navigate pages', async () => {
    const window = await app.firstWindow()

    // Open archive
    await window.click('text=Open File')
    await window.setInputFiles('input[type=file]', 'test-fixtures/comic.cbz')

    // Wait for first image to load
    await expect(window.locator('.image-viewer')).toBeVisible()

    // Navigate to next page
    await window.keyboard.press('ArrowRight')

    // Check page number updated
    await expect(window.locator('.page-number')).toHaveText('2 / 10')
  })
})
```

**Run E2E Tests**:
```bash
npm run test:e2e
npm run test:e2e:headed  # Show browser window
```

## Troubleshooting

### Common Issues

**Issue**: `Error: Cannot find module 'sharp'`
```bash
# Solution: Rebuild native modules
npx electron-rebuild
```

**Issue**: TypeScript errors in `src/shared/types`
```bash
# Solution: Rebuild TypeScript
npm run type-check
# Or delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Electron window won't open
```bash
# Check logs
tail -f ~/Library/Logs/myViewer/main.log  # macOS
# Windows: %APPDATA%\myViewer\logs\main.log
```

**Issue**: IPC communication not working
- Verify channel names match in main and renderer
- Check `contextIsolation` is enabled
- Ensure preload script is loaded correctly

## Next Steps

1. **Read Architecture Docs**: [plan.md](./plan.md), [data-model.md](./data-model.md)
2. **Review IPC Contracts**: [contracts/ipc-api.yaml](./contracts/ipc-api.yaml)
3. **Start with P1 User Stories**: Open archive, view images, navigate pages
4. **Write Tests First**: Follow TDD for core services
5. **Join Team Chat**: Ask questions, share progress

## Resources

- **Project Spec**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **IPC API**: [contracts/ipc-api.yaml](./contracts/ipc-api.yaml)
- **Electron Docs**: https://www.electronjs.org/docs
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/

---

**Need Help?**
- File a bug: GitHub Issues
- Ask a question: Team Slack channel
- Review code: Submit a PR

Happy coding! 🚀
