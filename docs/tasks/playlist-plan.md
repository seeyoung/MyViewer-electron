# Playlist (Folder/Archive Queue) 실행 계획

## 목표
- 폴더/압축파일 단위의 플레이리스트를 생성하고, 사용자가 정의한 순서로 소스를 감상할 수 있게 한다.
- Finder(외부 파일 탐색기)에서 드래그 앤 드롭, 앱 내부 Sidebar/Recent 목록에서 드래그 앤 드롭을 지원해 편리한 리스트 편집 경험 제공.
- 재생 중에는 현재 리스트 정보를 바탕으로 다음 폴더/압축파일로 자동 이동할 수 있도록 네비게이션과 연계.

## 파일 구조

### 신규 생성 파일
```
src/
├── main/
│   ├── db/
│   │   └── migrations/
│   │       └── 003_create_playlists.sql          # Playlist 테이블 생성 마이그레이션
│   ├── repositories/
│   │   └── PlaylistRepository.ts                  # Playlist CRUD Repository (NEW)
│   └── services/
│       └── PlaylistService.ts                     # Playlist 비즈니스 로직 (NEW)
├── renderer/
│   └── components/
│       └── playlist/
│           ├── PlaylistPanel.tsx                  # 메인 플레이리스트 패널 (NEW)
│           ├── PlaylistEntry.tsx                  # 개별 엔트리 컴포넌트 (NEW)
│           └── PlaylistControls.tsx               # 재생 컨트롤 (NEW)
└── shared/
    └── types/
        └── playlist.ts                             # Playlist 타입 정의 (NEW)
```

### 수정 대상 파일
```
src/
├── main/
│   ├── ipc/
│   │   └── handlers.ts                            # Playlist IPC 핸들러 추가
│   └── db/
│       └── init.ts                                # PlaylistRepository 초기화
├── renderer/
│   ├── App.tsx                                    # PlaylistPanel 통합
│   ├── components/
│   │   └── viewer/
│   │       └── NavigationBar.tsx                  # Playlist 버튼 추가 (line ~361)
│   ├── hooks/
│   │   └── useImageNavigation.ts                  # Playlist 네비게이션 로직 추가
│   ├── services/
│   │   └── ipc.ts                                 # Playlist IPC 클라이언트 메서드
│   └── store/
│       └── viewerStore.ts                         # Playlist 상태 추가
└── shared/
    └── constants/
        └── ipc-channels.ts                        # Playlist IPC 채널 정의
```

## TypeScript 타입 정의

### src/shared/types/playlist.ts
```typescript
/**
 * Playlist metadata
 */
export interface Playlist {
  id: string;                    // UUID v4
  name: string;                  // User-defined name
  description?: string;          // Optional description
  created_at: number;            // Unix timestamp (ms)
  updated_at: number;            // Unix timestamp (ms)
}

/**
 * Individual entry in a playlist
 */
export interface PlaylistEntry {
  playlist_id: string;           // Foreign key to playlists.id
  position: number;              // 0-based index (continuous integers)
  source_path: string;           // Absolute path (MUST be sanitized)
  source_type: 'folder' | 'archive';
  label: string;                 // Display name (basename or user-defined)
  thumbnail_path?: string;       // Optional cover image path
}

/**
 * Complete playlist with entries
 */
export interface PlaylistWithEntries {
  playlist: Playlist;
  entries: PlaylistEntry[];
}

/**
 * Playlist playback state
 */
export interface PlaylistPlaybackState {
  activePlaylistId: string | null;
  currentEntryIndex: number;     // -1 if no entry selected
  isPlaying: boolean;            // Auto-advance enabled
  autoAdvanceToNextEntry: boolean;
  loopMode: 'none' | 'playlist' | 'entry'; // Loop behavior
}
```

## 데이터베이스 스키마

### src/main/db/migrations/003_create_playlists.sql
```sql
-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,  -- Unix timestamp in milliseconds
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_playlists_updated_at ON playlists(updated_at DESC);

-- Create playlist_entries table
CREATE TABLE IF NOT EXISTS playlist_entries (
  playlist_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  source_path TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('folder', 'archive')),
  label TEXT NOT NULL,
  thumbnail_path TEXT,
  PRIMARY KEY (playlist_id, position),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE INDEX idx_playlist_entries_position ON playlist_entries(playlist_id, position);
```

**스키마 설계 노트:**
- `position`: 연속 정수로 관리. 재정렬 시 전체 업데이트 필요하지만 쿼리가 단순함
- `source_path`: 절대 경로로 저장. 로드 시 `sanitizePath()` 필수
- Cascade delete: Playlist 삭제 시 entries 자동 삭제
- 인덱스: `updated_at` (최근 플레이리스트 조회), `position` (순서 정렬)

## IPC API 명세

### src/shared/constants/ipc-channels.ts
```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Playlist management
  PLAYLIST_CREATE: 'playlist:create',
  PLAYLIST_UPDATE: 'playlist:update',
  PLAYLIST_DELETE: 'playlist:delete',
  PLAYLIST_GET_ALL: 'playlist:get-all',
  PLAYLIST_GET_BY_ID: 'playlist:get-by-id',

  // Playlist entries
  PLAYLIST_ADD_ENTRY: 'playlist:add-entry',
  PLAYLIST_ADD_ENTRIES_BATCH: 'playlist:add-entries-batch',
  PLAYLIST_REMOVE_ENTRY: 'playlist:remove-entry',
  PLAYLIST_REORDER_ENTRIES: 'playlist:reorder-entries',
  PLAYLIST_UPDATE_ENTRY: 'playlist:update-entry',

  // Playback state
  PLAYLIST_SET_ACTIVE: 'playlist:set-active',
  PLAYLIST_GET_ACTIVE: 'playlist:get-active',
} as const;
```

### IPC 채널 페이로드 타입

#### Playlist Management
```typescript
// playlist:create
Request: { name: string; description?: string }
Response: Playlist

// playlist:update
Request: { id: string; name?: string; description?: string }
Response: Playlist

// playlist:delete
Request: { id: string }
Response: void

// playlist:get-all
Request: void
Response: Playlist[]

// playlist:get-by-id
Request: { id: string }
Response: PlaylistWithEntries | null
```

#### Playlist Entries
```typescript
// playlist:add-entry
Request: {
  playlistId: string;
  sourcePath: string;  // Will be sanitized in handler
  position?: number;   // Optional, defaults to end
}
Response: PlaylistEntry

// playlist:add-entries-batch (for drag & drop multiple files)
Request: {
  playlistId: string;
  sourcePaths: string[];  // All will be sanitized
  insertPosition?: number;
}
Response: PlaylistEntry[]

// playlist:remove-entry
Request: { playlistId: string; position: number }
Response: void

// playlist:reorder-entries (for drag reordering)
Request: {
  playlistId: string;
  fromPosition: number;
  toPosition: number;
}
Response: PlaylistEntry[]

// playlist:update-entry
Request: {
  playlistId: string;
  position: number;
  updates: { label?: string; thumbnail_path?: string }
}
Response: PlaylistEntry
```

#### Playback State
```typescript
// playlist:set-active
Request: { playlistId: string | null; entryIndex?: number }
Response: PlaylistPlaybackState

// playlist:get-active
Request: void
Response: PlaylistPlaybackState
```

## 보안 고려사항 ⚠️

### Path Validation (CRITICAL)
모든 파일 경로는 MUST 다음 검증을 거쳐야 합니다:

```typescript
// PlaylistService.ts 예시
import { sanitizePath, validatePath, isPathWithinBase } from '@lib/file-utils';
import path from 'path';
import fs from 'fs';

async addEntry(playlistId: string, sourcePath: string) {
  // 1. Sanitize user input
  const sanitized = sanitizePath(sourcePath);

  // 2. Validate path exists and is accessible
  if (!validatePath(sanitized)) {
    throw new Error('Invalid or inaccessible path');
  }

  // 3. Check file/folder exists
  if (!fs.existsSync(sanitized)) {
    throw new Error('Path does not exist');
  }

  // 4. Verify it's absolute path (security requirement)
  if (!path.isAbsolute(sanitized)) {
    throw new Error('Only absolute paths are allowed');
  }

  // 5. Determine source type
  const stat = fs.statSync(sanitized);
  const sourceType = stat.isDirectory() ? 'folder' : 'archive';

  // 6. Store sanitized path
  return this.repository.addEntry(playlistId, {
    source_path: sanitized,
    source_type: sourceType,
    // ...
  });
}
```

### 추가 보안 요구사항
- **Context Isolation**: Renderer에서 파일 시스템 접근 금지 (IPC만 사용)
- **Input Sanitization**: 모든 IPC 입력값 검증
- **SQL Injection 방지**: Prepared statements 사용 (better-sqlite3 기본 제공)
- **Path Traversal 방지**: `../`, 심볼릭 링크 해결 후 검증
- **Permission Check**: 파일/폴더 읽기 권한 확인 (`fs.access()`)

## viewerStore 상태 확장

### src/renderer/store/viewerStore.ts 추가 필드
```typescript
interface ViewerStore {
  // ... existing fields ...

  // Playlist state
  playlists: Playlist[];                        // All playlists
  activePlaylist: Playlist | null;              // Currently selected playlist
  playlistEntries: PlaylistEntry[];             // Entries of active playlist
  currentEntryIndex: number;                    // -1 if none selected
  isPlaylistMode: boolean;                      // Playlist mode enabled
  autoAdvanceToNextEntry: boolean;              // Auto-advance on last page
  playlistLoopMode: 'none' | 'playlist' | 'entry';
  showPlaylistPanel: boolean;                   // Panel visibility

  // Playlist actions
  setPlaylists: (playlists: Playlist[]) => void;
  setActivePlaylist: (playlist: Playlist | null) => void;
  setPlaylistEntries: (entries: PlaylistEntry[]) => void;
  setCurrentEntryIndex: (index: number) => void;
  togglePlaylistMode: () => void;
  toggleAutoAdvance: () => void;
  setPlaylistLoopMode: (mode: 'none' | 'playlist' | 'entry') => void;
  togglePlaylistPanel: () => void;

  // Navigation integration
  goToNextEntry: () => Promise<void>;
  goToPrevEntry: () => Promise<void>;
  goToEntryByIndex: (index: number) => Promise<void>;
}
```

**초기값:**
```typescript
{
  playlists: [],
  activePlaylist: null,
  playlistEntries: [],
  currentEntryIndex: -1,
  isPlaylistMode: false,
  autoAdvanceToNextEntry: true,
  playlistLoopMode: 'none',
  showPlaylistPanel: false,
}
```

## UI 컴포넌트 계층 구조

```
App.tsx
└── <div className="app-layout">
    ├── Header (existing)
    ├── NavigationBar (modified)
    │   └── PlaylistButton → toggles PlaylistPanel
    ├── <div className="main-content">
    │   ├── FolderSidebar (existing)
    │   ├── ImageViewer (existing)
    │   ├── BottomThumbnails (existing)
    │   └── PlaylistPanel (NEW - right drawer, conditionally rendered)
    │       ├── PlaylistHeader
    │       │   ├── Playlist selector dropdown
    │       │   └── New/Edit/Delete buttons
    │       ├── PlaylistControls (NEW)
    │       │   ├── Play/Pause button
    │       │   ├── Auto-advance toggle
    │       │   ├── Loop mode selector
    │       │   └── Clear all button
    │       ├── DropZone (for external drag & drop)
    │       └── PlaylistEntryList
    │           └── PlaylistEntry[] (NEW - draggable items)
    │               ├── Thumbnail
    │               ├── Label (editable)
    │               ├── Source type badge
    │               └── Remove button
    └── Footer (existing)
```

**레이아웃 스타일:**
- PlaylistPanel: `position: fixed; right: 0; width: 320px; height: 100vh; z-index: 100`
- Backdrop overlay when panel open (optional)
- Slide-in animation (transform: translateX)

## 작업 항목

### 1. 데이터 모델/저장소
- [ ] **마이그레이션 생성**: `src/main/db/migrations/003_create_playlists.sql` (위 SQL 스키마 참조)
- [ ] **PlaylistRepository 구현**: `src/main/repositories/PlaylistRepository.ts`
  - [ ] `createPlaylist(name, description)`
  - [ ] `updatePlaylist(id, updates)`
  - [ ] `deletePlaylist(id)`
  - [ ] `getAllPlaylists()`
  - [ ] `getPlaylistById(id)` - entries 포함
  - [ ] `addEntry(playlistId, entry)`
  - [ ] `addEntriesBatch(playlistId, entries, insertPosition)`
  - [ ] `removeEntry(playlistId, position)` - 이후 position 재정렬
  - [ ] `reorderEntries(playlistId, fromPos, toPos)`
  - [ ] `updateEntry(playlistId, position, updates)`
- [ ] **DB 초기화**: `src/main/db/init.ts`에 PlaylistRepository 등록

### 2. 서비스 레이어 구현
- [ ] **PlaylistService 생성**: `src/main/services/PlaylistService.ts`
  - [ ] Constructor에 PlaylistRepository, ArchiveService, FolderService 주입
  - [ ] `createPlaylist(name, description)` - UUID v4 생성, 타임스탬프 추가
  - [ ] `addSourceToPlaylist(playlistId, sourcePath)` - 경로 sanitize 후 타입 판별, 라벨 생성
  - [ ] `addMultipleSources(playlistId, sourcePaths, insertPosition)` - 배치 추가
  - [ ] `reorderEntry(playlistId, from, to)` - position 재정렬 로직
  - [ ] `validateEntry(entry)` - 경로 존재 여부, 접근 권한 확인
  - [ ] `cleanupInvalidEntries(playlistId)` - 존재하지 않는 경로 제거
  - [ ] 모든 경로에 대해 `sanitizePath()`, `validatePath()` 적용 ⚠️

### 3. IPC 핸들러 등록
- [ ] **IPC 채널 정의**: `src/shared/constants/ipc-channels.ts`에 위 "IPC API 명세" 채널 추가
- [ ] **핸들러 구현**: `src/main/ipc/handlers.ts`
  - [ ] Playlist management 핸들러 (create, update, delete, get-all, get-by-id)
  - [ ] Playlist entries 핸들러 (add-entry, add-entries-batch, remove-entry, reorder, update)
  - [ ] Playback state 핸들러 (set-active, get-active)
  - [ ] 모든 핸들러에 try-catch 에러 래핑
  - [ ] 에러 발생 시 user-friendly 메시지 반환
- [ ] **IPC 클라이언트**: `src/renderer/services/ipc.ts`
  - [ ] 각 채널에 대응하는 타입 안전 메서드 추가
  - [ ] 예: `createPlaylist(name, desc)`, `addPlaylistEntry(id, path)`, etc.

### 4. 드래그 앤 드롭 처리
- [ ] **외부 파일 드롭**: `App.tsx` 또는 `PlaylistPanel.tsx`에 전역 drop 핸들러
  ```typescript
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const paths = files.map(f => f.path).filter(Boolean);
    if (activePlaylist) {
      ipcService.addPlaylistEntriesBatch(activePlaylist.id, paths);
    }
  };
  ```
- [ ] **앱 내부 드래그**: React DnD 또는 @dnd-kit 사용
  - [ ] Recent sources → Playlist 드롭
  - [ ] FolderSidebar → Playlist 드롭
  - [ ] Playlist 내 순서 변경 드래그

### 5. Zustand Store 확장
- [ ] **viewerStore.ts 수정**: 위 "viewerStore 상태 확장" 섹션의 필드 추가
  - [ ] Playlist 상태 필드 추가
  - [ ] Playlist 액션 함수 구현
  - [ ] `goToNextEntry`, `goToPrevEntry`, `goToEntryByIndex` 구현
    - SourceDescriptor 변환 후 기존 `openArchive`/`openFolder` 재사용

### 6. UI 컴포넌트 구현
- [ ] **PlaylistPanel.tsx**: `src/renderer/components/playlist/PlaylistPanel.tsx`
  - [ ] Right drawer layout (320px width, fixed position)
  - [ ] Playlist selector dropdown (multiple playlists 지원)
  - [ ] New/Edit/Delete playlist buttons
  - [ ] Drop zone for external drag & drop
  - [ ] Entry list container with scroll
- [ ] **PlaylistControls.tsx**: `src/renderer/components/playlist/PlaylistControls.tsx`
  - [ ] Play/Pause toggle (isPlaylistMode)
  - [ ] Auto-advance toggle switch
  - [ ] Loop mode selector (none/playlist/entry)
  - [ ] Clear all entries button
- [ ] **PlaylistEntry.tsx**: `src/renderer/components/playlist/PlaylistEntry.tsx`
  - [ ] Draggable item (using @dnd-kit or react-beautiful-dnd)
  - [ ] Thumbnail preview (썸네일 서비스 재사용)
  - [ ] Editable label (inline edit on double-click)
  - [ ] Source type badge (folder/archive icon)
  - [ ] Remove button with confirmation
  - [ ] Active state highlight
- [ ] **NavigationBar.tsx 수정**: Playlist toggle button 추가 (line ~361)
  - [ ] Icon button with badge (entry count)
  - [ ] `onClick={() => togglePlaylistPanel()}`

### 7. 네비게이션 연동
- [ ] **useImageNavigation.ts 확장**
  - [ ] `goToNext()` 수정: 마지막 페이지일 때 playlist 체크
    ```typescript
    // Existing logic for within-source navigation
    if (isLastPage && isPlaylistMode && autoAdvanceToNextEntry) {
      await goToNextEntry();
      return;
    }
    ```
  - [ ] `goToPrevious()` 수정: 첫 페이지일 때 이전 entry로
  - [ ] Playlist entry 전환 시 SessionService 통합 (마지막 페이지 복원)
- [ ] **App.tsx 통합**
  - [ ] PlaylistPanel 조건부 렌더링
  - [ ] Playlist mode일 때 키보드 단축키 확장 (Ctrl+Right → next entry)

### 8. 에러 처리 및 UX 개선
- [ ] **Entry 검증 및 안내**
  - [ ] 앱 시작 시 또는 playlist 로드 시 `validateEntry()` 실행
  - [ ] 존재하지 않는 경로: 항목에 warning badge, 클릭 시 상세 메시지
  - [ ] "Clean up invalid entries" 버튼 제공
- [ ] **Graceful Fallback**
  - [ ] Entry 열기 실패 시 에러 메시지 + 다음 entry로 건너뛰기 제안
  - [ ] 연속 3회 실패 시 자동 재생 중단
- [ ] **상태 저장**
  - [ ] 앱 종료 시 active playlist ID, entry index 저장 (localStorage or DB)
  - [ ] 재시작 시 복원
- [ ] **중복 처리 정책**
  - [ ] 동일 경로 추가 시 경고 모달 ("Already exists. Add anyway?")
  - [ ] Settings에서 중복 허용 여부 토글 제공
- [ ] **긴 리스트 최적화**
  - [ ] Virtual scrolling (react-window) 적용 (100+ entries)
  - [ ] 검색/필터 입력 필드 추가

### 9. 추가 기능 및 정책 정의
- [ ] **Loop 모드 동작 정의**
  - `none`: 마지막 entry의 마지막 페이지에서 정지
  - `playlist`: 마지막 entry → 첫 번째 entry로 순환
  - `entry`: 현재 entry의 마지막 페이지 → 첫 페이지로 (entry 내 loop)
- [ ] **다중 플레이리스트 관리**
  - [ ] Playlist 생성 모달 (이름, 설명 입력)
  - [ ] Playlist 이름 변경 (inline edit)
  - [ ] Playlist 삭제 확인 모달
  - [ ] Recent playlists 표시 (updated_at 기준)
- [ ] **Undo/Redo (선택사항)**
  - [ ] Entry 삭제/순서 변경 시 undo stack 관리
  - [ ] Ctrl+Z / Ctrl+Shift+Z 단축키
  - [ ] 최근 10개 작업만 유지

## 에러 처리 매트릭스

| 에러 타입 | 발생 시점 | 처리 방법 | 사용자 메시지 | Fallback 동작 |
|----------|----------|----------|--------------|--------------|
| **경로 존재하지 않음** | Entry 로드/클릭 시 | Warning badge 표시 | "File not found: {path}" | Entry 건너뛰기 제안 |
| **접근 권한 없음** | Entry 추가/열기 시 | 에러 모달 | "Permission denied" | Entry 추가 취소 |
| **잘못된 경로 형식** | Entry 추가 시 | 입력 거부 | "Invalid path format" | 추가하지 않음 |
| **압축 파일 손상** | Archive 열기 시 | 에러 토스트 | "Corrupted archive" | 다음 entry로 이동 |
| **빈 폴더/아카이브** | 소스 열기 시 | 경고 토스트 | "No images found" | Entry 유지, 표시만 |
| **DB 쓰기 실패** | CRUD 작업 시 | 재시도 1회, 실패 시 에러 | "Failed to save playlist" | 메모리 상태만 유지 |
| **네트워크 드라이브 연결 끊김** | Entry 로드 시 | Timeout 후 에러 | "Network path unavailable" | Offline badge, 재시도 버튼 |
| **중복 경로 추가** | Entry 추가 시 | 확인 모달 (정책에 따라) | "Path already exists. Add anyway?" | 사용자 선택 |
| **마이그레이션 실패** | 앱 시작 시 | 앱 종료, 로그 기록 | "Database error. Please report" | 이전 버전으로 롤백 불가 |
| **IPC 통신 실패** | 모든 IPC 호출 | 3회 재시도, 실패 시 에러 | "Connection error. Restart app" | 작업 취소 |

## 구현 체크리스트

### Phase 1: 기반 구조 (Backend)
- [ ] TypeScript 타입 정의 (`src/shared/types/playlist.ts`)
- [ ] 데이터베이스 마이그레이션 (`003_create_playlists.sql`)
- [ ] PlaylistRepository 구현
- [ ] PlaylistService 구현 (보안 검증 포함 ⚠️)
- [ ] IPC 채널 정의 및 핸들러 등록
- [ ] IPC 클라이언트 메서드 추가

### Phase 2: 상태 관리 (Frontend State)
- [ ] viewerStore에 Playlist 상태 추가
- [ ] Playlist 액션 함수 구현
- [ ] Entry 네비게이션 로직 구현

### Phase 3: UI 컴포넌트 (Frontend UI)
- [ ] PlaylistPanel.tsx 구현
- [ ] PlaylistControls.tsx 구현
- [ ] PlaylistEntry.tsx 구현
- [ ] NavigationBar.tsx에 Playlist 버튼 추가
- [ ] App.tsx에 PlaylistPanel 통합

### Phase 4: 드래그 앤 드롭
- [ ] 외부 파일 드롭 핸들러 (Electron File objects)
- [ ] 앱 내부 드래그 (DnD 라이브러리 통합)
- [ ] 순서 변경 드래그

### Phase 5: 네비게이션 통합
- [ ] useImageNavigation 확장 (playlist 경계 처리)
- [ ] SessionService 통합 (페이지 복원)
- [ ] 키보드 단축키 확장

### Phase 6: 에러 처리 및 검증
- [ ] Entry 검증 로직
- [ ] 에러 메시지 및 fallback 구현
- [ ] Invalid entries cleanup 기능

### Phase 7: UX 개선
- [ ] Loop 모드 구현
- [ ] 다중 플레이리스트 관리 UI
- [ ] 중복 처리 정책
- [ ] Virtual scrolling (긴 리스트)
- [ ] 검색/필터 기능
- [ ] Undo/Redo (선택사항)

### Phase 8: 상태 저장 및 복원
- [ ] Active playlist 저장 (앱 종료 시)
- [ ] Playback state 복원 (앱 시작 시)

## 검증 포인트

### 기능 검증
- [ ] Finder에서 끌어온 폴더/압축파일이 즉시 리스트에 추가됨
- [ ] 리스트 항목 클릭 시 해당 소스로 정상 이동
- [ ] 재생 순서대로 Next/Prev 작동
- [ ] 마지막 entry의 마지막 페이지에서 loop 모드에 따라 동작
- [ ] 앱 재시작 후 playlist 및 상태 복원
- [ ] 여러 플레이리스트 생성/전환 가능

### 보안 검증 ⚠️
- [ ] Path traversal 공격 차단 (`../` 등)
- [ ] 절대 경로만 허용
- [ ] 접근 권한 없는 파일 차단
- [ ] SQL injection 방지 (prepared statements)
- [ ] IPC 입력값 모두 검증됨

### 에러 처리 검증
- [ ] 존재하지 않는 경로 처리 (warning badge)
- [ ] 접근 불가 경로 처리 (에러 메시지)
- [ ] 손상된 아카이브 처리 (graceful skip)
- [ ] 연속 실패 시 자동 재생 중단
- [ ] DB 쓰기 실패 시 재시도
- [ ] IPC 실패 시 재시도 로직

### UX 검증
- [ ] 드래그 시 순서 삽입 위치 시각적 표시
- [ ] Entry 삭제 시 확인 요청
- [ ] 중복 추가 시 경고 모달
- [ ] Virtual scrolling (100+ entries 테스트)
- [ ] 키보드 단축키 작동 (Ctrl+Right, Delete 등)
- [ ] Undo/Redo 작동 (구현 시)

### 성능 검증
- [ ] 100+ entries 로드 시 UI 반응성
- [ ] 대용량 아카이브 전환 시 메모리 누수 없음
- [ ] Thumbnail 로딩이 viewport 내만 우선 처리
- [ ] DB 쿼리 성능 (인덱스 활용 확인)

## 참고 자료

### 관련 파일
- **기존 기능 참조**:
  - `src/main/services/ArchiveService.ts` - Archive 열기 로직
  - `src/main/services/FolderService.ts` - Folder 스캔 로직
  - `src/main/services/SessionService.ts` - 세션 관리 패턴
  - `src/renderer/hooks/useImageNavigation.ts` - 네비게이션 로직
  - `src/renderer/components/viewer/BottomThumbnails.tsx` - 드래그 가능한 리스트 예시

### 라이브러리 후보
- **Drag & Drop**: `@dnd-kit/core` (권장) 또는 `react-beautiful-dnd`
- **Virtual Scrolling**: `react-window` 또는 `@tanstack/react-virtual`
- **UUID**: `uuid` (v4)
- **Icons**: 프로젝트 기존 아이콘 시스템 활용

### 프로젝트 규칙
- TypeScript strict mode 준수
- ESLint/Prettier 적용 (`npm run lint:fix`, `npm run format`)
- 100자 line limit
- Single quotes, semicolons
- Zustand for state management
- IPC 채널은 `ipc-channels.ts`에 정의
- 경로는 MUST `sanitizePath()` 처리 ⚠️

---

**문서 작성일**: 2025-11-14
**최종 업데이트**: 2025-11-14
**작성자**: Claude (AI Assistant)
