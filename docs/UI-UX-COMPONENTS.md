# MyViewer UI/UX 개선 계획 - 컴포넌트별 개선

**작성일:** 2025-11-18
**버전:** 1.0
**우선순위:** 중간 (Medium)

## 목차

- [1. App.tsx](#1-apptsx)
- [2. NavigationBar](#2-navigationbar)
- [3. ImageViewer](#3-imageviewer)
- [4. FolderSidebar](#4-foldersidebar)
- [5. BottomThumbnails](#5-bottomthumbnails)
- [6. LoadingIndicator & ErrorBoundary](#6-loadingindicator--errorboundary)

---

## 1. App.tsx

**파일:** `src/renderer/App.tsx`
**현재 라인 수:** ~400줄
**우선순위:** 높음

### 1.1 현재 문제점

1. **헤더 정보 과부하**
   - 최근 파일 칩 5개까지 표시
   - 썸네일 위치 선택 라디오 버튼
   - 화면 좁아지면 레이아웃 깨짐

2. **Welcome 화면 개선 필요**
   - 텍스트 중심의 단조로운 디자인
   - 지원 포맷 나열만
   - CTA 버튼 없음

3. **레이아웃 복잡도**
   - 4개 패널 동시 표시 가능 (헤더, 사이드바, 뷰어, 슬라이드쇼)
   - 공간 활용 비효율

### 1.2 개선 방안

#### 1.2.1 헤더 간소화

**변경 전 (~라인 200-250):**
```tsx
<header style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 1.5rem',
  background: '#2d2d2d',
  borderBottom: '1px solid #444',
}}>
  <h1>MyViewer</h1>

  {/* 최근 파일 5개 */}
  <div style={{ display: 'flex', gap: '0.5rem' }}>
    {recentSources.slice(0, 5).map(source => (
      <Chip key={source.path} ... />
    ))}
  </div>

  {/* 썸네일 위치 선택 */}
  <div>
    <label>
      <input type="radio" ... /> Sidebar
    </label>
    <label>
      <input type="radio" ... /> Bottom
    </label>
  </div>
</header>
```

**변경 후 (개선):**
```tsx
<header style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3) var(--space-6)',
  background: 'var(--color-bg-panel)',
  borderBottom: `1px solid var(--color-border-default)`,
}}>
  {/* 왼쪽: 로고 + 열기 버튼 */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
    <h1 style={{
      fontSize: 'var(--font-size-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0,
    }}>
      MyViewer
    </h1>
    <button
      onClick={handleOpenArchive}
      className="button button-primary"
      aria-label="Open archive file"
    >
      Open File
    </button>
  </div>

  {/* 중앙: 최근 파일 (최대 3개) */}
  {recentSources.length > 0 && (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      flex: 1,
      justifyContent: 'center',
      maxWidth: '50%',
    }}>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
      }}>
        Recent:
      </span>
      {recentSources.slice(0, 3).map(source => (
        <Chip key={source.path} source={source} />
      ))}
      {recentSources.length > 3 && (
        <button
          className="button button-ghost button-sm"
          onClick={() => setShowRecentDialog(true)}
          aria-label="Show all recent files"
        >
          +{recentSources.length - 3} more
        </button>
      )}
    </div>
  )}

  {/* 오른쪽: 설정 아이콘 */}
  <button
    className="button button-icon button-ghost"
    onClick={() => setShowSettings(true)}
    aria-label="Open settings"
  >
    ⚙️
  </button>
</header>

{/* 설정 모달 (썸네일 위치 등 포함) */}
{showSettings && (
  <SettingsModal
    onClose={() => setShowSettings(false)}
    thumbnailPosition={thumbnailPosition}
    onThumbnailPositionChange={setThumbnailPosition}
  />
)}
```

**개선 효과:**
- ✅ 헤더 높이 감소 (더 많은 이미지 공간)
- ✅ 최근 파일 3개로 제한 (시각적 혼잡도 감소)
- ✅ 설정을 모달로 분리 (필요 시에만 표시)
- ✅ 반응형 레이아웃 (flex 사용)

#### 1.2.2 Welcome 화면 개선

**변경 후:**
```tsx
const WelcomeScreen = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 'var(--space-8)',
    textAlign: 'center',
  }}>
    {/* 아이콘 */}
    <div style={{
      fontSize: '4rem',
      marginBottom: 'var(--space-6)',
      opacity: 0.6,
    }}>
      📚
    </div>

    {/* 제목 */}
    <h2 className="heading-2">
      Welcome to MyViewer
    </h2>

    {/* 설명 */}
    <p className="body-text" style={{
      maxWidth: '500px',
      marginBottom: 'var(--space-6)',
    }}>
      Open archive files (ZIP, RAR, 7Z) or folders to start viewing images.
      Drag and drop files anywhere to get started.
    </p>

    {/* CTA 버튼 */}
    <div style={{
      display: 'flex',
      gap: 'var(--space-3)',
      marginBottom: 'var(--space-8)',
    }}>
      <button
        onClick={handleOpenArchive}
        className="button button-primary button-lg"
      >
        Open Archive
      </button>
      <button
        onClick={handleOpenFolder}
        className="button button-secondary button-lg"
      >
        Open Folder
      </button>
    </div>

    {/* 지원 포맷 (접을 수 있게) */}
    <details style={{ maxWidth: '600px' }}>
      <summary style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
        cursor: 'pointer',
      }}>
        Supported formats
      </summary>
      <div style={{
        marginTop: 'var(--space-3)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
      }}>
        <strong>Archives:</strong> ZIP, CBZ, RAR, CBR, 7Z, TAR<br />
        <strong>Images:</strong> JPEG, PNG, GIF, BMP, TIFF, WebP, PSD, SVG
      </div>
    </details>

    {/* 키보드 단축키 힌트 */}
    <div style={{
      marginTop: 'var(--space-8)',
      padding: 'var(--space-4)',
      background: 'var(--color-bg-surface)',
      borderRadius: 'var(--border-radius-md)',
      maxWidth: '400px',
    }}>
      <div className="caption" style={{ marginBottom: 'var(--space-2)' }}>
        Quick tips:
      </div>
      <div style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        textAlign: 'left',
      }}>
        • Drag files to open<br />
        • Arrow keys to navigate<br />
        • +/- to zoom<br />
        • F11 for fullscreen
      </div>
    </div>
  </div>
);
```

### 1.3 체크리스트

- [ ] 헤더 간소화 (최근 파일 3개로 제한)
- [ ] 설정 모달 컴포넌트 생성
- [ ] Welcome 화면 리디자인
- [ ] 드래그 앤 드롭 힌트 추가
- [ ] 반응형 레이아웃 테스트

---

## 2. NavigationBar

**파일:** `src/renderer/components/viewer/NavigationBar.tsx`
**현재 라인 수:** ~361줄
**우선순위:** 높음 (긴급)

### 2.1 현재 문제점

1. **UI 밀집도 매우 높음**
   - 한 줄에 10개 이상의 컨트롤
   - 버튼 그룹 구분 불명확
   - 좁은 화면에서 오버플로우

2. **아이콘 일관성 없음**
   - 이모지 (🔍, ↔, ↕)
   - 텍스트 ("Previous", "Next")
   - 혼재

3. **버튼 스타일 불일치**
   - Active 상태 표시 방식 다름
   - 크기, 간격 일관성 없음

### 2.2 개선 방안

#### 2.2.1 버튼 그룹화

```tsx
// 변경 후 구조
<nav
  role="navigation"
  aria-label="Image navigation"
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-bg-panel)',
    borderBottom: `1px solid var(--color-border-default)`,
    gap: 'var(--space-4)',
  }}
>
  {/* 왼쪽: 페이지 네비게이션 */}
  <div className="button-group" style={{ display: 'flex', gap: 'var(--space-1)' }}>
    <button
      className="button button-icon"
      onClick={handleFirst}
      disabled={isFirst}
      aria-label="Go to first page"
      title="First (Home)"
    >
      ⏮
    </button>
    <button
      className="button button-icon"
      onClick={handlePrevious}
      disabled={isFirst}
      aria-label="Go to previous page"
      title="Previous (←)"
    >
      ◀
    </button>

    {/* 페이지 카운터 */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      padding: '0 var(--space-2)',
      minWidth: '120px',
      justifyContent: 'center',
    }}>
      <input
        type="number"
        value={currentPage + 1}
        onChange={handlePageInput}
        min={1}
        max={totalPages}
        style={{
          width: '60px',
          textAlign: 'center',
        }}
        aria-label="Current page number"
      />
      <span className="body-small">/ {totalPages}</span>
    </div>

    <button
      className="button button-icon"
      onClick={handleNext}
      disabled={isLast}
      aria-label="Go to next page"
      title="Next (→)"
    >
      ▶
    </button>
    <button
      className="button button-icon"
      onClick={handleLast}
      disabled={isLast}
      aria-label="Go to last page"
      title="Last (End)"
    >
      ⏭
    </button>
  </div>

  {/* 중앙: 줌 컨트롤 */}
  <div className="button-group" style={{ display: 'flex', gap: 'var(--space-1)' }}>
    <button
      className="button button-icon"
      onClick={handleZoomOut}
      aria-label="Zoom out"
      title="Zoom out (-)"
    >
      🔍−
    </button>

    <button
      className="button button-secondary"
      onClick={handleResetZoom}
      style={{ minWidth: '80px' }}
      aria-label="Reset zoom to 100%"
      title="Reset zoom (0)"
    >
      {Math.round(zoomLevel * 100)}%
    </button>

    <button
      className="button button-icon"
      onClick={handleZoomIn}
      aria-label="Zoom in"
      title="Zoom in (+)"
    >
      🔍+
    </button>
  </div>

  {/* 오른쪽: 핏 모드 + 기타 */}
  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
    {/* 핏 모드 그룹 */}
    <div
      className="button-group"
      role="group"
      aria-label="Fit mode"
      style={{ display: 'flex', gap: 'var(--space-1)' }}
    >
      <button
        className={`button button-icon ${fitMode === 'FIT_WIDTH' ? 'active' : ''}`}
        onClick={() => setFitMode('FIT_WIDTH')}
        aria-label="Fit to width"
        aria-pressed={fitMode === 'FIT_WIDTH'}
        title="Fit width (W)"
      >
        ↔
      </button>
      <button
        className={`button button-icon ${fitMode === 'FIT_HEIGHT' ? 'active' : ''}`}
        onClick={() => setFitMode('FIT_HEIGHT')}
        aria-label="Fit to height"
        aria-pressed={fitMode === 'FIT_HEIGHT'}
        title="Fit height (H)"
      >
        ↕
      </button>
      <button
        className={`button button-icon ${fitMode === 'ACTUAL_SIZE' ? 'active' : ''}`}
        onClick={() => setFitMode('ACTUAL_SIZE')}
        aria-label="Actual size"
        aria-pressed={fitMode === 'ACTUAL_SIZE'}
        title="Actual size (1)"
      >
        1:1
      </button>
    </div>

    {/* 추가 컨트롤 */}
    <button
      className="button button-secondary"
      onClick={toggleFolderSidebar}
      aria-label="Toggle folder sidebar"
      aria-expanded={showFolderTree}
    >
      📁
    </button>

    <button
      className="button button-secondary"
      onClick={toggleFullscreen}
      aria-label="Toggle fullscreen"
      title="Fullscreen (F11)"
    >
      ⛶
    </button>
  </div>
</nav>
```

**CSS 추가 (button.css):**
```css
/* Button Group */
.button-group {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--color-bg-surface);
  border-radius: var(--border-radius-base);
}

.button-group .button {
  margin: 0;
}

/* Active State for Toggle Buttons */
.button.active {
  background: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.button.active:hover {
  background: var(--color-primary-hover);
}
```

#### 2.2.2 반응형 대응

**미디어 쿼리 추가:**
```css
/* 좁은 화면 (< 1024px) */
@media (max-width: 1024px) {
  .nav-bar {
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .button-group {
    flex: 1;
    justify-content: center;
  }
}

/* 매우 좁은 화면 (< 768px) */
@media (max-width: 768px) {
  .nav-bar {
    flex-direction: column;
  }

  .button-text {
    display: none; /* 아이콘만 표시 */
  }
}
```

### 2.3 체크리스트

- [ ] 버튼을 논리적 그룹으로 분리
- [ ] 모든 버튼에 aria-label 추가
- [ ] Active 상태 스타일 통일
- [ ] 아이콘 통일 (이모지 → SVG 아이콘 고려)
- [ ] 반응형 레이아웃 구현
- [ ] 툴팁 추가 (title 속성)

---

## 3. ImageViewer

**파일:** `src/renderer/components/viewer/ImageViewer.tsx`
**현재 라인 수:** ~376줄
**우선순위:** 중간

### 3.1 현재 문제점

1. **로딩 상태 개선 필요**
   - 단순 "Loading..." 텍스트
   - 진행률 표시 없음

2. **줌/팬 UX**
   - 더블 클릭 줌 없음
   - 줌 경계 시각적 표시 없음

3. **풀스크린 모드**
   - 플로팅 툴바가 마우스에만 반응
   - 애니메이션 없음

### 3.2 개선 방안

#### 3.2.1 스켈레톤 로딩

**LoadingIndicator 개선:**
```tsx
const ImageLoadingSkeleton = () => (
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-4)',
  }}>
    {/* 스켈레톤 이미지 */}
    <div
      style={{
        width: '60%',
        height: '70%',
        background: 'linear-gradient(90deg, var(--color-bg-surface) 0%, var(--color-bg-hover) 50%, var(--color-bg-surface) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: 'var(--border-radius-md)',
      }}
    />

    {/* 로딩 텍스트 */}
    <div style={{ textAlign: 'center' }}>
      <div className="body-text">Loading image...</div>
      <div className="caption">Please wait</div>
    </div>
  </div>
);

// CSS 애니메이션
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```
```

#### 3.2.2 더블 클릭 줌

```tsx
const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
  const stage = e.target.getStage();
  if (!stage) return;

  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  if (zoomLevel === 1) {
    // 줌 인 (2배)
    const newZoom = 2;
    const mousePointTo = {
      x: (pointer.x - position.x) / zoomLevel,
      y: (pointer.y - position.y) / zoomLevel,
    };

    setZoomLevel(newZoom);
    setPosition({
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    });
    setFitMode('CUSTOM');
  } else {
    // 줌 아웃 (리셋)
    handleFitToWidth();
  }
};

// Stage에 적용
<Stage
  onDblClick={handleDoubleClick}
  ...
>
```

#### 3.2.3 에러 상태 개선

```tsx
const ImageErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-4)',
    padding: 'var(--space-8)',
  }}>
    {/* 에러 아이콘 */}
    <div style={{
      fontSize: '4rem',
      opacity: 0.5,
    }}>
      ⚠️
    </div>

    {/* 에러 메시지 */}
    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
      <h3 className="heading-3">Failed to load image</h3>
      <p className="body-text">{error}</p>
    </div>

    {/* 액션 버튼 */}
    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
      <button
        className="button button-primary"
        onClick={onRetry}
      >
        Try Again
      </button>
      <button
        className="button button-secondary"
        onClick={() => window.history.back()}
      >
        Go Back
      </button>
    </div>
  </div>
);
```

### 3.3 체크리스트

- [ ] 스켈레톤 로딩 구현
- [ ] 더블 클릭 줌 기능 추가
- [ ] 에러 상태 UI 개선
- [ ] 풀스크린 툴바 애니메이션
- [ ] 줌 경계 표시 (선택 사항)

---

## 4. FolderSidebar

**파일:** `src/renderer/components/viewer/FolderSidebar.tsx`
**현재 라인 수:** ~316줄
**우선순위:** 중간

### 4.1 현재 문제점

1. **폴더 트리**
   - 확장/축소 기능 없음
   - 폴더 아이콘 없음
   - 깊은 폴더 탐색 어려움

2. **썸네일 그리드**
   - 가상 스크롤 미구현 (200개 제한)
   - 로딩 상태 불명확

3. **탭 전환**
   - 애니메이션 없음

### 4.2 개선 방안

#### 4.2.1 폴더 확장/축소

```tsx
// 상태 추가
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

// 폴더 토글 함수
const toggleFolder = (path: string) => {
  setExpandedFolders(prev => {
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
};

// 폴더 아이템 렌더링
const FolderItem = ({ folder, depth }: { folder: FolderNode; depth: number }) => {
  const isExpanded = expandedFolders.has(folder.path);
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2)',
          paddingLeft: `calc(var(--space-4) * ${depth})`,
          cursor: 'pointer',
          background: isActive ? 'var(--color-bg-hover)' : 'transparent',
        }}
        onClick={() => handleFolderClick(folder)}
      >
        {/* 확장/축소 버튼 */}
        {hasChildren && (
          <button
            className="button button-icon button-sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder.path);
            }}
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            style={{ padding: 'var(--space-1)' }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* 폴더 아이콘 */}
        <span style={{ fontSize: '1.2em' }}>
          {isExpanded ? '📂' : '📁'}
        </span>

        {/* 폴더 이름 */}
        <span style={{
          flex: 1,
          color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}>
          {folder.name}
        </span>

        {/* 이미지 개수 */}
        <span className="caption">
          {folder.totalImages}
        </span>
      </div>

      {/* 하위 폴더 */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children?.map(child => (
            <FolderItem key={child.path} folder={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
```

#### 4.2.2 썸네일 가상 스크롤

**라이브러리 사용:** `react-window` 또는 `react-virtualized`

```tsx
import { FixedSizeGrid } from 'react-window';

const ThumbnailGrid = ({ images }: { images: Image[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setDimensions({ width, height });
  }, []);

  const columnCount = Math.floor(dimensions.width / 120); // 썸네일 너비 + 간격
  const rowCount = Math.ceil(images.length / columnCount);

  const Cell = ({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= images.length) return null;

    const image = images[index];
    return (
      <div style={style}>
        <ThumbnailItem image={image} index={index} />
      </div>
    );
  };

  return (
    <div ref={containerRef} style={{ flex: 1 }}>
      <FixedSizeGrid
        columnCount={columnCount}
        columnWidth={120}
        height={dimensions.height}
        rowCount={rowCount}
        rowHeight={120}
        width={dimensions.width}
      >
        {Cell}
      </FixedSizeGrid>
    </div>
  );
};
```

#### 4.2.3 탭 애니메이션

```css
.tab-content {
  animation: slideInUp 0.2s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 4.3 체크리스트

- [ ] 폴더 확장/축소 구현
- [ ] 폴더 아이콘 추가
- [ ] react-window로 가상 스크롤 구현
- [ ] 탭 전환 애니메이션
- [ ] 폴더 검색 기능 (선택 사항)

---

## 5. BottomThumbnails

**파일:** `src/renderer/components/viewer/BottomThumbnails.tsx`
**현재 라인 수:** ~282줄
**우선순위:** 낮음

### 5.1 현재 문제점

1. **고정 높이**
   - 150px로 고정
   - 사용자 조절 불가

2. **스크롤바**
   - webkit만 스타일링
   - 다른 브라우저 미지원

### 5.2 개선 방안

#### 5.2.1 리사이징 가능하게

```tsx
const [height, setHeight] = useState(150);
const [isResizing, setIsResizing] = useState(false);

const handleMouseDown = (e: React.MouseEvent) => {
  setIsResizing(true);
  const startY = e.clientY;
  const startHeight = height;

  const handleMouseMove = (e: MouseEvent) => {
    const delta = startY - e.clientY;
    const newHeight = Math.max(100, Math.min(300, startHeight + delta));
    setHeight(newHeight);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

return (
  <div style={{ height }}>
    {/* 리사이즈 핸들 */}
    <div
      onMouseDown={handleMouseDown}
      style={{
        height: '4px',
        background: 'var(--color-border-default)',
        cursor: 'ns-resize',
      }}
    />

    {/* 썸네일 */}
    <div style={{ ... }}>
      {/* ... */}
    </div>
  </div>
);
```

### 5.3 체크리스트

- [ ] 높이 리사이징 구현
- [ ] 크로스 브라우저 스크롤바 스타일
- [ ] 최소/최대 높이 제한

---

## 6. LoadingIndicator & ErrorBoundary

**파일:** `src/renderer/components/shared/`
**우선순위:** 높음

### 6.1 LoadingIndicator 개선

**현재:**
```tsx
const LoadingIndicator = () => (
  <div>Loading...</div>
);
```

**개선:**
```tsx
const LoadingIndicator = ({ message = 'Loading...' }: { message?: string }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-3)',
  }}>
    {/* 스피너 */}
    <div className="spinner" />

    {/* 메시지 */}
    <div className="body-small" style={{ color: 'var(--color-text-secondary)' }}>
      {message}
    </div>
  </div>
);

// CSS
```css
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-bg-hover);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```
```

### 6.2 ErrorBoundary 개선

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  // ...

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: 'var(--space-8)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>
            💥
          </div>

          <h2 className="heading-2">Something went wrong</h2>

          <p className="body-text" style={{
            maxWidth: '500px',
            textAlign: 'center',
            marginBottom: 'var(--space-6)',
          }}>
            We're sorry, but the application encountered an unexpected error.
            Please try again or contact support if the problem persists.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>

            <button
              className="button button-secondary"
              onClick={() => this.setState({ showDetails: !this.state.showDetails })}
            >
              {this.state.showDetails ? 'Hide' : 'Show'} Details
            </button>
          </div>

          {this.state.showDetails && (
            <pre style={{
              marginTop: 'var(--space-6)',
              padding: 'var(--space-4)',
              background: 'var(--color-bg-surface)',
              borderRadius: 'var(--border-radius-base)',
              maxWidth: '800px',
              overflow: 'auto',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-error)',
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 6.3 체크리스트

- [ ] LoadingIndicator 스피너 추가
- [ ] ErrorBoundary UI 개선
- [ ] 에러 세부정보 토글
- [ ] 로딩 진행률 표시 (선택 사항)

---

## 7. 전체 구현 우선순위

### Week 1-2: 긴급 (Critical)
1. NavigationBar 리팩토링
2. 접근성 개선 (ARIA, 색상 대비)
3. 디자인 시스템 구축

### Week 3-4: 높음 (High)
1. App.tsx 헤더 간소화
2. Welcome 화면 개선
3. LoadingIndicator & ErrorBoundary

### Week 5-6: 중간 (Medium)
1. FolderSidebar 폴더 트리 개선
2. ImageViewer 더블 클릭 줌
3. 썸네일 가상 스크롤

### Week 7+: 낮음 (Low)
1. BottomThumbnails 리사이징
2. 고급 애니메이션
3. 추가 기능 (검색, 필터 등)

---

**관련 문서:**
- [UI-UX-OVERVIEW.md](./UI-UX-OVERVIEW.md) - 전체 개요
- [UI-UX-ACCESSIBILITY.md](./UI-UX-ACCESSIBILITY.md) - 접근성
- [UI-UX-VISUAL-DESIGN.md](./UI-UX-VISUAL-DESIGN.md) - 디자인 시스템
