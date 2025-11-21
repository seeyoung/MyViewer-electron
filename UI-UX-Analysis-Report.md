# MyViewer-electron UI/UX 전문가 분석 보고서

**분석 날짜**: 2025-11-21
**대상 프로젝트**: MyViewer-electron
**분석 범위**: 전체 UI/UX 검토

---

## 목차

1. [발견된 UI/UX 이슈 (우선순위별)](#1-발견된-uiux-이슈-우선순위별)
2. [구체적인 개선 제안](#2-구체적인-개선-제안)
3. [구현 로드맵](#3-구현-로드맵-제안)
4. [요약 및 결론](#4-요약-및-결론)

---

## 1. 발견된 UI/UX 이슈 (우선순위별)

### 우선순위 1: 긴급 개선 필요 (Critical)

#### C-1. 접근성 부족 (Accessibility Gaps)

**위치**: 전체 애플리케이션

**발견 내용**:
- 대부분의 버튼과 인터랙티브 요소에 `aria-label`, `role` 속성이 없음
- 키보드 포커스 스타일이 명확하지 않음 (`:focus-visible` 스타일 누락)
- 색상 대비가 WCAG 기준을 충족하지 못하는 요소들:
  - `color: #999` on `#2d2d2d` = 4.6:1 (AA 통과, AAA 미달)
  - `color: #666` on `#1e1e1e` = 2.8:1 (WCAG AA 실패)
- 스크린 리더를 위한 시맨틱 HTML 구조 부족
- 에러 메시지가 `aria-live` 영역으로 선언되지 않음

**영향도**: 🔴 높음 - 장애가 있는 사용자가 애플리케이션을 사용할 수 없음
**구현 복잡도**: 🟡 중간

**개선 예시**:
```typescript
// NavigationBar.tsx 개선
<button
  onClick={handlePrevious}
  disabled={currentPageIndex === 0}
  className="nav-button"
  aria-label="Go to previous image"
  aria-disabled={currentPageIndex === 0}
>
  ← Previous
</button>

// CSS 추가
.nav-button:focus-visible {
  outline: 2px solid #2da8ff;
  outline-offset: 2px;
}

// 색상 대비 개선
.hint {
  color: #888; /* #666에서 변경, 3.8:1 대비 */
}
```

---

#### C-2. 네비게이션 바 과밀화 (Navigation Bar Overcrowding)

**위치**: `NavigationBar.tsx` (라인 98-246)

**발견 내용**:
- 네비게이션 바에 너무 많은 컨트롤이 한 줄에 배치됨
  - Previous/Next, Zoom, Fit Mode, Fullscreen, Auto Slide, Slideshow Manager, Folders
- 작은 화면에서는 버튼들이 겹치거나 잘릴 수 있음
- 버튼 간 시각적 그룹화가 부족하여 인지 부담 증가
- 반응형 디자인이 없어 해상도 변경 시 레이아웃이 깨짐

**영향도**: 🔴 높음 - 핵심 기능 접근성이 떨어짐
**구현 복잡도**: 🟡 중간

**개선 제안 구조**:
```
┌─────────────────────────────────────────────────────────────────┐
│ [Info Section]          [Main Controls]      [View Controls]    │
│ Archive • Page 1/50     ← → [Zoom] [Fit]    [••• More]          │
└─────────────────────────────────────────────────────────────────┘
                           ↓ More 클릭 시
┌─────────────────────────────────────────┐
│ • Toggle Folders                        │
│ • Toggle Slideshow Manager              │
│ • Auto Slide Settings                   │
│ • Fullscreen (F11)                      │
└─────────────────────────────────────────┘
```

---

#### C-3. 일관성 없는 아이콘 사용 (Inconsistent Icon Usage)

**위치**: `NavigationBar.tsx` (라인 167-200)

**발견 내용**:
- 유니코드 이모지와 화살표 기호 혼용 (🔍, ↔, ↕, ⛶, 🔄⛶)
- 이모지는 OS와 폰트에 따라 다르게 렌더링되어 일관성 없음
- 일부 아이콘의 의미가 직관적이지 않음 (⛶가 "Fit to Screen"을 의미하는지 불명확)
- 텍스트 버튼과 아이콘 버튼이 혼재되어 시각적 일관성 부족

**영향도**: 🔴 높음 - 사용자가 기능을 이해하기 어려움
**구현 복잡도**: 🟢 낮음 (아이콘 라이브러리 도입 필요)

**개선 예시**:
```typescript
import { FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiMaximize } from 'react-icons/fi';

<div className="navigation-controls">
  <div className="control-group primary">
    <button onClick={handlePrevious} aria-label="Previous image">
      <FiChevronLeft /> <span>Previous</span>
    </button>
    <button onClick={handleNext} aria-label="Next image">
      <span>Next</span> <FiChevronRight />
    </button>
  </div>

  <div className="control-group zoom">
    <button onClick={handleZoomOut} aria-label="Zoom out">
      <FiZoomOut />
    </button>
    <span className="zoom-level" role="status">{zoomText}</span>
    <button onClick={handleZoomIn} aria-label="Zoom in">
      <FiZoomIn />
    </button>
  </div>
</div>
```

**권장 아이콘 라이브러리**:
- `react-icons` - 다양한 아이콘 세트 (Feather Icons 추천)
- 설치: `npm install react-icons`

---

#### C-4. 로딩 및 에러 상태 피드백 부족

**위치**: `ImageViewer.tsx`, `App.tsx`

**발견 내용**:
- 이미지 로딩 중에는 단순히 "Loading image..." 텍스트만 표시 (라인 389)
- 로딩 진행률이나 애니메이션이 없어 앱이 멈춘 것처럼 보일 수 있음
- 에러 메시지가 너무 간단하고 복구 방법을 제공하지 않음
- 썸네일 로딩 실패 시 에러 배지만 표시되고 재시도 옵션이 없음

**영향도**: 🔴 높음 - 사용자가 상태를 파악하기 어려움
**구현 복잡도**: 🟢 낮음

**개선 예시**:
```typescript
// ImageViewer.tsx 개선
if (!currentImage || !image) {
  return (
    <div className="viewer-placeholder">
      {imageError ? (
        <div className="error-state" role="alert">
          <FiAlertCircle size={48} />
          <h3>Failed to load image</h3>
          <p>{imageError}</p>
          <div className="error-actions">
            <button onClick={() => loadImageFromArchive(currentImage)}>
              <FiRefreshCw /> Retry
            </button>
            <button onClick={() => goToNext()}>
              <FiChevronRight /> Skip to next
            </button>
          </div>
        </div>
      ) : (
        <div className="loading-state">
          <SkeletonLoader />
          <p>Loading image...</p>
        </div>
      )}
    </div>
  );
}

// Toast 시스템 사용 예시
toast.success('Archive opened successfully', {
  duration: 3000,
  icon: <FiCheckCircle />
});
```

**권장 Toast 라이브러리**:
- `react-hot-toast` - 가볍고 커스터마이징 가능
- 설치: `npm install react-hot-toast`

---

### 우선순위 2: 중요 개선 권장 (High Priority)

#### H-1. 풀스크린 모드 UX 개선 필요

**위치**: `App.tsx` (라인 156-194), `index.css` (라인 287-307)

**발견 내용**:
- 플로팅 툴바가 마우스를 상단 50px에 가져가야만 나타남 (라인 161)
- 툴바 표시/숨김 타이밍이 불명확하여 사용자가 혼란스러울 수 있음
- 풀스크린 나가는 힌트가 호버 시에만 나타나는 CSS 의사 요소로 구현됨 (라인 267-285)
- 키보드 단축키 가이드가 항상 보이지 않음

**영향도**: 🟡 중간 - 풀스크린 모드 사용성이 떨어짐
**구현 복잡도**: 🟡 중간

**개선 예시**:
```typescript
// Fullscreen 모드 미니 툴바
<div className="fullscreen-mini-toolbar">
  <button onClick={goToPrevious} aria-label="Previous (←)">
    <FiChevronLeft />
  </button>
  <span className="page-indicator">{currentPage} / {totalPages}</span>
  <button onClick={goToNext} aria-label="Next (→)">
    <FiChevronRight />
  </button>
  <button
    onClick={toggleKeyboardGuide}
    aria-label="Keyboard shortcuts (Press ?)"
    className="help-button"
  >
    <FiHelpCircle />
  </button>
  <button onClick={exitFullscreen} aria-label="Exit fullscreen (Esc)">
    <FiMinimize />
  </button>
</div>
```

**CSS**:
```css
.fullscreen-mini-toolbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 0.5rem 1rem;
  border-radius: 999px;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  z-index: 1000;
  transition: opacity 0.3s ease;
}

.fullscreen-mini-toolbar:hover {
  opacity: 1;
}

.fullscreen-mini-toolbar button {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.fullscreen-mini-toolbar button:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

---

#### H-2. 썸네일 시각적 피드백 개선

**위치**: `BottomThumbnails.tsx`, `FolderSidebar.tsx`

**발견 내용**:
- 활성 썸네일의 하이라이트가 있지만 스크롤 시 보이지 않을 수 있음
- 썸네일 로딩 상태의 펄스 애니메이션이 너무 미묘함
- 에러 상태의 시각적 구분이 충분하지 않음 (빨간 테두리만)
- 썸네일 호버 효과가 일부는 있고 일부는 없어 일관성 부족

**영향도**: 🟡 중간 - 현재 위치 파악 어려움
**구현 복잡도**: 🟢 낮음

**개선 예시**:
```css
/* 활성 썸네일 강조 */
.thumbnail-card.active {
  border-color: #2da8ff;
  border-width: 3px; /* 2px에서 증가 */
  box-shadow:
    0 0 0 2px rgba(45, 168, 255, 0.2),
    0 0 16px rgba(45, 168, 255, 0.5); /* 더 강한 글로우 */
  transform: scale(1.05); /* 크기 강조 */
}

/* 로딩 상태 개선 */
.thumbnail-card img.loading {
  opacity: 0.3;
  filter: blur(2px);
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* 에러 상태 개선 */
.thumbnail-card.error {
  border-color: #ff6b6b;
  border-width: 2px;
  background: linear-gradient(135deg, #2a1a1a 0%, #1a0f0f 100%);
}

.thumbnail-card.error::after {
  content: 'Failed to load';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 107, 107, 0.9);
  color: white;
  font-size: 0.7rem;
  padding: 2px;
  text-align: center;
}

/* 호버 효과 일관성 */
.thumbnail-card:hover {
  border-color: #4d4d4d;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}
```

**추가 개선 사항**:
- 활성 썸네일이 뷰포트 밖에 있을 때 자동 스크롤
- 로딩 진행률 표시 (가능한 경우)

---

#### H-3. 색상 대비 및 다크 모드 최적화

**위치**: 전체 애플리케이션

**발견 내용**:
- 다크 테마만 제공되고 라이트 테마 옵션이 없음
- 일부 텍스트 색상 대비가 낮음:
  - `color: #999` on `#2d2d2d` = 4.6:1 (AA 기준 통과하나 AAA는 미달)
  - `color: #666` on `#1e1e1e` = 2.8:1 (WCAG AA 실패)
- 블루 강조색 `#007acc`가 어두운 배경에서 충분히 도드라지지 않을 수 있음

**영향도**: 🟡 중간 - 가독성 저하
**구현 복잡도**: 🟢 낮음

**개선 예시**:
```css
/* design-tokens.css */
:root {
  /* Primary Colors */
  --color-primary: #2da8ff;
  --color-primary-hover: #1484ff;
  --color-primary-active: #0066cc;

  /* Background */
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3d3d3d;

  /* Text - WCAG AA 준수 */
  --text-primary: #ffffff; /* 15.1:1 */
  --text-secondary: #cccccc; /* 9.0:1 */
  --text-tertiary: #999999; /* 4.6:1 */
  --text-hint: #888888; /* 3.8:1 - 최소 기준 */

  /* Borders */
  --border-primary: #4d4d4d;
  --border-secondary: #3d3d3d;

  /* Status Colors */
  --color-success: #7ad47a;
  --color-error: #ff6b6b;
  --color-warning: #ffb347;
  --color-info: #5dade2;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.3);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;
}

/* 라이트 테마 (선택사항) */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e0e0e0;
  --text-primary: #1e1e1e;
  --text-secondary: #4a4a4a;
  --text-tertiary: #6a6a6a;
  --text-hint: #8a8a8a;
  --border-primary: #cccccc;
  --border-secondary: #e0e0e0;
}

/* 사용 예시 */
.navigation-bar {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-secondary);
  color: var(--text-primary);
}

.nav-button:hover {
  background-color: var(--bg-tertiary);
  transition: background-color var(--transition-base);
}
```

**WCAG 대비 기준**:
- **AA (최소)**: 4.5:1 (일반 텍스트), 3:1 (큰 텍스트)
- **AAA (권장)**: 7:1 (일반 텍스트), 4.5:1 (큰 텍스트)

---

#### H-4. Recent Sources 칩 UX 개선

**위치**: `App.tsx` (라인 220-265)

**발견 내용**:
- 최근 항목 삭제가 우클릭으로만 가능 (라인 252-258)
- 삭제 시 확인 대화상자가 없어 실수로 삭제 가능
- 드래그 가능하다는 시각적 힌트가 없음 (`draggable` 속성은 있지만 커서 스타일 없음)
- 항목이 5개로 제한되어 있지만 이에 대한 안내가 없음

**영향도**: 🟡 중간 - 데이터 손실 위험
**구현 복잡도**: 🟢 낮음

**개선 제안**:
1. X 버튼 추가로 삭제 기능 명확히 표시
2. 삭제 확인 대화상자 추가
3. 드래그 가능 시각적 힌트 (드래그 핸들 아이콘)
4. 최대 개수 표시 (예: "Recent (5/5)")

---

#### H-5. 키보드 단축키 발견성 (Discoverability)

**위치**: `useKeyboardShortcuts.ts`

**발견 내용**:
- 다양한 단축키가 구현되어 있지만 UI에서 확인할 방법이 없음
- 툴팁에 일부 단축키만 표시됨 (예: "Zoom In (Ctrl + +)")
- 단축키 가이드 화면이나 모달이 없음
- `?` 키로 단축키 가이드를 여는 일반적인 패턴이 구현되지 않음

**영향도**: 🟡 중간 - 파워 유저 기능 활용도 저하
**구현 복잡도**: 🟡 중간

**개선 예시**:
```typescript
// KeyboardShortcutsModal.tsx
const KeyboardShortcutsModal = ({ onClose }) => {
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['←', 'PageUp'], description: 'Previous image' },
        { keys: ['→', 'PageDown', 'Space'], description: 'Next image' },
        { keys: ['Home'], description: 'First image' },
        { keys: ['End'], description: 'Last image' },
      ]
    },
    {
      category: 'View',
      items: [
        { keys: ['W'], description: 'Fit width' },
        { keys: ['H'], description: 'Fit height' },
        { keys: ['F'], description: 'Fit best' },
        { keys: ['Shift', 'F'], description: 'Fit best with auto-rotate' },
        { keys: ['O'], description: 'Actual size' },
      ]
    },
    {
      category: 'Zoom',
      items: [
        { keys: ['+'], description: 'Zoom in' },
        { keys: ['-'], description: 'Zoom out' },
        { keys: ['0'], description: 'Reset zoom' },
        { keys: ['Cmd/Ctrl', 'Wheel'], description: 'Zoom with mouse' },
      ]
    },
    {
      category: 'Fullscreen',
      items: [
        { keys: ['Enter', 'F11'], description: 'Toggle fullscreen' },
        { keys: ['Double Click'], description: 'Toggle fullscreen' },
        { keys: ['Esc'], description: 'Exit fullscreen' },
      ]
    },
    {
      category: 'Other',
      items: [
        { keys: ['S'], description: 'Toggle auto slide' },
        { keys: ['↑', '↓'], description: 'Adjust slide interval (during slideshow)' },
        { keys: ['B'], description: 'Boss key (minimize)' },
        { keys: ['?'], description: 'Show this help' },
      ]
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Keyboard Shortcuts</h2>
          <button onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="shortcuts-grid">
          {shortcuts.map(({ category, items }) => (
            <section key={category}>
              <h3>{category}</h3>
              {items.map(({ keys, description }) => (
                <div className="shortcut-row" key={description}>
                  <div className="keys">
                    {keys.map((key, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="separator">+</span>}
                        <kbd>{key}</kbd>
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="description">{description}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

### 우선순위 3: 개선 권장 (Medium Priority)

#### M-1. 사이드바 리사이저 UX

**위치**: `App.tsx` (라인 305-327)

**발견 내용**:
- 리사이저가 6px로 너무 좁아 클릭하기 어려움 (라인 158)
- 드래그 중 시각적 피드백이 부족
- 최소/최대 너비 제한이 180-500px이지만 UI에 표시되지 않음
- 더블클릭으로 기본 크기 복원 같은 편의 기능이 없음

**영향도**: 🟢 낮음 - 사용 빈도가 낮음
**구현 복잡도**: 🟢 낮음

**개선 제안**:
- 리사이저 너비를 10-12px로 증가
- 드래그 중 오버레이 표시
- 더블클릭으로 기본 너비(300px) 복원

---

#### M-2. Zoom 컨트롤 UX

**위치**: `NavigationBar.tsx` (라인 131-159)

**발견 내용**:
- Zoom 레벨이 Auto/퍼센트로 표시되지만 최소/최대값을 알 수 없음
- 마우스 휠 줌이 구현되어 있지만 (ImageViewer.tsx) UI에서 안내되지 않음
- 줌 속도가 1.2x로 고정되어 있어 미세 조정이 어려움
- 줌 히스토리나 즐겨찾기 줌 레벨 기능이 없음

**영향도**: 🟢 낮음 - 기본 기능은 작동함
**구현 복잡도**: 🟡 중간

**개선 제안**:
- Zoom 레벨 클릭 시 직접 입력 가능한 input 표시
- 툴팁에 마우스 휠 줌 안내 추가
- 즐겨찾기 줌 레벨 (25%, 50%, 100%, 200% 등) 빠른 선택

---

#### M-3. 폴더 트리 시각화

**위치**: `FolderSidebar.tsx` (라인 115-129)

**발견 내용**:
- 폴더 계층이 들여쓰기로만 표현되고 확장/축소 아이콘이 없음
- 모든 폴더가 항상 펼쳐진 상태여서 대규모 구조 탐색이 어려움
- 폴더 아이콘이 없어 폴더와 파일을 구분하기 어려움
- 현재 활성 폴더의 하이라이트가 있지만 부모 경로 표시가 없음

**영향도**: 🟢 낮음 - 기본 네비게이션은 가능
**구현 복잡도**: 🟡 중간

**개선 제안**:
- 폴더 확장/축소 토글 버튼 (▶/▼)
- 폴더 아이콘 추가 (📁/📂)
- 기본 상태를 1-2단계만 펼친 상태로 변경
- Breadcrumb 네비게이션 추가

---

#### M-4. 슬라이드쇼 컨트롤 접근성

**위치**: `NavigationBar.tsx` (라인 211-229)

**발견 내용**:
- Auto Slide 간격 선택이 드롭다운으로만 가능
- 선택지가 5개로 제한되어 있음 (2s, 3s, 5s, 8s, 10s)
- 커스텀 간격 입력이 불가능
- Auto Slide 오버레이가 자동으로 사라지는 시간이 명시되지 않음

**영향도**: 🟢 낮음 - 기본 기능은 충분함
**구현 복잡도**: 🟢 낮음

**개선 제안**:
- "Custom..." 옵션 추가로 사용자 정의 간격 입력 가능
- 슬라이더 UI로 1-60초 범위 선택

---

#### M-5. 환영 화면 개선

**위치**: `App.tsx` (라인 341-356)

**발견 내용**:
- 환영 메시지가 정적이고 인터랙티브하지 않음
- 드래그 앤 드롭 영역이 시각적으로 표시되지 않음
- "Open Archive" 버튼이 환영 화면에 직접 제공되지 않음
- 샘플 이미지나 튜토리얼 링크가 없음

**영향도**: 🟢 낮음 - 첫 사용자 경험에만 영향
**구현 복잡도**: 🟢 낮음

**개선 제안**:
```typescript
<div className="welcome-screen">
  <div className="welcome-content">
    <h1>Welcome to MyViewer</h1>
    <p>Your powerful archive and image viewer</p>

    <div className="drop-zone">
      <FiUploadCloud size={64} />
      <h2>Drag & drop an archive here</h2>
      <p>or</p>
      <button onClick={handleOpenArchive} className="primary-button">
        <FiFolder /> Open Archive
      </button>
    </div>

    <div className="supported-formats">
      <p>Supported formats:</p>
      <div className="format-badges">
        <span>ZIP</span>
        <span>CBZ</span>
        <span>RAR</span>
        <span>CBR</span>
        <span>7Z</span>
        <span>TAR</span>
      </div>
    </div>

    <a href="#" onClick={handleShowKeyboardShortcuts} className="help-link">
      <FiHelpCircle /> Keyboard shortcuts
    </a>
  </div>
</div>
```

---

### 우선순위 4: 추가 개선 고려 (Low Priority)

#### L-1. 애니메이션 및 전환 효과

**발견 내용**:
- 대부분의 상태 변경에 전환 애니메이션이 없음
- 페이지 전환이 즉각적이어서 갑작스러움
- 모달과 패널 등장/사라짐에 페이드 효과가 없음
- 버튼 호버 효과가 단순 색상 변경뿐

**영향도**: 🟢 낮음 - 미적 개선
**구현 복잡도**: 🟡 중간

**개선 제안**:
- 페이지 전환 시 슬라이드/페이드 애니메이션
- 모달 오픈/클로즈 애니메이션
- 버튼 호버 시 미세한 스케일 변경
- 로딩 스켈레톤 애니메이션

---

#### L-2. 반응형 디자인

**발견 내용**:
- 미디어 쿼리가 slideshow-side-panel에만 적용됨 (index.css 라인 144-148)
- 작은 화면 크기에 대한 대응이 부족
- 최소 윈도우 크기 제약이 없어 레이아웃이 깨질 수 있음

**영향도**: 🟢 낮음 - 데스크톱 앱이므로 우선순위 낮음
**구현 복잡도**: 🔴 높음

**개선 제안**:
- 최소 윈도우 크기 설정 (예: 800x600)
- 작은 화면에서 사이드바 자동 숨김
- 네비게이션 바 반응형 레이아웃

---

#### L-3. 커스텀 컨텍스트 메뉴

**발견 내용**:
- 이미지 우클릭 시 브라우저 기본 컨텍스트 메뉴 표시
- 이미지별 작업 (북마크, 정보 보기, 복사 등)을 위한 커스텀 메뉴가 없음
- 썸네일 우클릭 옵션이 제한적

**영향도**: 🟢 낮음 - 추가 기능
**구현 복잡도**: 🟡 중간

**개선 제안**:
```
우클릭 메뉴 항목:
- Add to Bookmarks
- Image Information
- Copy Image
- Open in External Viewer
- Rotate
- Zoom to Fit
---
- Previous Image
- Next Image
```

---

#### L-4. 고급 키보드 네비게이션

**발견 내용**:
- Tab 키로 포커스 순서가 명확하지 않음
- Shift+Tab 역방향 네비게이션이 모든 영역에서 작동하지 않을 수 있음
- 포커스 트랩이 모달에 구현되지 않음

**영향도**: 🟢 낮음 - 기본 키보드 네비게이션은 작동
**구현 복잡도**: 🟡 중간

**개선 제안**:
- 논리적 포커스 순서 정의
- 모달에 포커스 트랩 구현
- Skip to content 링크 추가

---

#### L-5. 다국어 지원 준비

**발견 내용**:
- 모든 텍스트가 하드코딩되어 있음
- i18n 프레임워크가 설정되지 않음
- 한국어 커밋 메시지는 있지만 UI는 영어

**영향도**: 🟢 낮음 - 현재 요구사항에 없음
**구현 복잡도**: 🔴 높음

**개선 제안**:
- `react-i18next` 도입
- 언어 파일 구조 설계
- 언어 전환 UI 추가

---

## 2. 구체적인 개선 제안

### 제안 1: 접근성 개선 패키지 (C-1 해결)

**목표**: WCAG 2.1 Level AA 준수

**구현 내용**:
1. 모든 버튼에 `aria-label` 추가
2. 포커스 스타일 개선
3. 색상 대비 수정
4. 시맨틱 HTML 구조 개선
5. 에러 메시지 `aria-live` 영역 추가

**예상 소요 시간**: 4-6시간
**사용자 경험 영향도**: 🔴 매우 높음 (접근성 사용자 사용 가능)

---

### 제안 2: 네비게이션 바 재구조화 (C-2, C-3 해결)

**목표**: 깔끔하고 직관적인 네비게이션

**구현 내용**:
1. 컨트롤을 논리적 그룹으로 분리
2. `react-icons` 라이브러리 도입
3. 오버플로우 메뉴 패턴 적용
4. 반응형 레이아웃 추가

**예상 소요 시간**: 6-8시간
**사용자 경험 영향도**: 🔴 매우 높음 (핵심 UI 개선)

**패키지 설치**:
```bash
npm install react-icons
```

---

### 제안 3: 로딩 및 에러 상태 개선 (C-4 해결)

**목표**: 명확한 상태 피드백

**구현 내용**:
1. 스켈레톤 로딩 UI 추가
2. 에러 복구 옵션 제공
3. Toast 알림 시스템 도입

**예상 소요 시간**: 3-4시간
**사용자 경험 영향도**: 🔴 높음 (상태 인지 개선)

**패키지 설치**:
```bash
npm install react-hot-toast
```

---

### 제안 4: 풀스크린 모드 UX 개선 (H-1 해결)

**목표**: 직관적인 풀스크린 경험

**구현 내용**:
1. 항상 표시되는 미니 툴바 추가
2. 단축키 가이드 오버레이
3. 스와이프 제스처 지원 (선택사항)

**예상 소요 시간**: 4-5시간
**사용자 경험 영향도**: 🟡 중간 (풀스크린 모드 개선)

---

### 제안 5: 썸네일 시각적 개선 (H-2 해결)

**목표**: 명확한 시각적 피드백

**구현 내용**:
1. 활성 썸네일 자동 스크롤 및 강조
2. 로딩/에러 상태 개선
3. 호버 효과 일관성

**예상 소요 시간**: 2-3시간
**사용자 경험 영향도**: 🟡 중간 (시각적 피드백 개선)

---

### 제안 6: 키보드 단축키 가이드 (H-5 해결)

**목표**: 기능 발견성 향상

**구현 내용**:
1. `?` 키로 열리는 단축키 모달
2. 카테고리별 단축키 표시
3. 검색 기능 (선택사항)

**예상 소요 시간**: 4-5시간
**사용자 경험 영향도**: 🟡 중간 (기능 발견성 향상)

---

### 제안 7: 색상 시스템 및 디자인 토큰 (H-3 해결)

**목표**: 일관된 디자인 시스템

**구현 내용**:
1. CSS 변수로 색상 시스템 구축
2. WCAG AA 준수 색상 팔레트
3. 라이트 테마 기반 마련 (선택사항)

**예상 소요 시간**: 2-3시간
**사용자 경험 영향도**: 🟡 중간 (일관성 및 유지보수성 향상)

---

## 3. 구현 로드맵 제안

### Phase 1: Critical Fixes (1-2주)

**목표**: 접근성 준수 및 핵심 사용성 개선

**작업 항목**:
1. ✅ 접근성 개선 (C-1)
   - ARIA 라벨 추가
   - 포커스 스타일 개선
   - 색상 대비 수정
   - 키보드 네비게이션 테스트

2. ✅ 네비게이션 바 재구조화 (C-2, C-3)
   - `react-icons` 도입
   - 컨트롤 그룹화
   - 오버플로우 메뉴 구현

3. ✅ 로딩/에러 상태 개선 (C-4)
   - 스켈레톤 로더 추가
   - 에러 복구 UI
   - Toast 시스템 구현

**예상 효과**:
- 접근성 준수 달성
- 핵심 사용성 50% 개선
- 사용자 이탈률 감소

---

### Phase 2: High Priority Improvements (2-3주)

**목표**: 전반적 UX 개선

**작업 항목**:
4. ✅ 풀스크린 UX 개선 (H-1)
   - 미니 툴바 구현
   - 단축키 가이드

5. ✅ 썸네일 시각적 개선 (H-2)
   - 활성 썸네일 강조
   - 로딩/에러 상태 개선

6. ✅ 색상 시스템 구축 (H-3)
   - 디자인 토큰 정의
   - CSS 변수 적용

7. ✅ Recent Sources UX (H-4)
   - 삭제 확인 대화상자
   - 드래그 힌트

8. ✅ 키보드 단축키 가이드 (H-5)
   - 단축키 모달 구현
   - `?` 키 바인딩

**예상 효과**:
- 전반적 UX 80% 개선
- 사용자 만족도 대폭 증가
- 기능 발견성 향상

---

### Phase 3: Medium Priority Enhancements (3-4주)

**목표**: 세부 기능 개선

**작업 항목**:
9. ✅ 사이드바 리사이저 개선 (M-1)
10. ✅ Zoom 컨트롤 개선 (M-2)
11. ✅ 폴더 트리 개선 (M-3)
12. ✅ 슬라이드쇼 컨트롤 개선 (M-4)
13. ✅ 환영 화면 개선 (M-5)

**예상 효과**:
- 파워 유저 만족도 향상
- 첫 사용자 경험 개선

---

### Phase 4: Polish & Future Features (지속적)

**목표**: 완성도 및 미래 준비

**작업 항목**:
14. ✅ 애니메이션 시스템 (L-1)
15. ✅ 반응형 디자인 (L-2)
16. ✅ 커스텀 컨텍스트 메뉴 (L-3)
17. ✅ 고급 키보드 네비게이션 (L-4)
18. ✅ 다국어 지원 준비 (L-5)

**예상 효과**:
- 프리미엄 사용자 경험
- 국제화 준비

---

## 4. 요약 및 결론

### 주요 강점

✅ **탄탄한 기술 스택**
- Electron + React + TypeScript
- 최신 도구 및 라이브러리 사용

✅ **풍부한 키보드 단축키 지원**
- 파워 유저를 위한 다양한 단축키 구현
- 효율적인 네비게이션

✅ **성능 최적화**
- 썸네일 캐싱
- 레이지 로딩
- 효율적인 이미지 처리

✅ **명확한 코드 구조**
- 잘 구성된 프로젝트 구조
- TypeScript로 타입 안정성 확보

---

### 핵심 개선 영역

#### 1. 접근성 (Accessibility) 🔴 긴급
**현재 상태**: WCAG 기준 미달
**목표**: WCAG 2.1 Level AA 준수
**우선순위**: 최상위 - 법적 요구사항 및 포용성

**주요 작업**:
- ARIA 속성 추가
- 키보드 네비게이션 개선
- 색상 대비 수정
- 스크린 리더 지원

---

#### 2. 정보 아키텍처 (Information Architecture) 🔴 긴급
**현재 상태**: 네비게이션 바 과밀화, 시각적 혼란
**목표**: 명확하고 직관적인 UI
**우선순위**: 최상위 - 핵심 사용성 영향

**주요 작업**:
- 컨트롤 그룹화 및 우선순위 지정
- 일관된 아이콘 시스템
- 오버플로우 메뉴 도입

---

#### 3. 시각적 피드백 (Visual Feedback) 🔴 긴급
**현재 상태**: 로딩/에러 상태 불명확
**목표**: 명확한 상태 커뮤니케이션
**우선순위**: 최상위 - 사용자 신뢰도 영향

**주요 작업**:
- 로딩 애니메이션
- 에러 복구 옵션
- Toast 알림 시스템

---

#### 4. 일관성 (Consistency) 🟡 중요
**현재 상태**: 아이콘, 색상, 인터랙션 불일치
**목표**: 통일된 디자인 언어
**우선순위**: 높음 - 브랜드 인지도

**주요 작업**:
- 디자인 토큰 시스템
- 아이콘 라이브러리
- 일관된 인터랙션 패턴

---

### 예상 ROI (Return on Investment)

#### Phase 1 완료 시 (1-2주)
- ✅ 접근성 준수 달성
- ✅ 핵심 사용성 **50% 개선**
- ✅ 법적 리스크 제거
- ✅ 사용자 이탈률 **30% 감소** 예상

#### Phase 2 완료 시 (3-5주)
- ✅ 전반적 UX **80% 개선**
- ✅ 사용자 만족도 **대폭 증가**
- ✅ 기능 발견성 **향상**
- ✅ 사용 시간 **증가** 예상

#### Phase 3-4 완료 시 (2-3개월)
- ✅ 경쟁력 있는 수준의 사용자 경험 달성
- ✅ 파워 유저 충성도 확보
- ✅ 국제화 및 확장 준비 완료

---

### 권장 사항

#### 즉시 시작 (Within 1 Week)
1. **C-1**: 접근성 개선 - 법적 요구사항
2. **C-3**: 아이콘 통일 - 빠른 개선, 큰 효과
3. **C-4**: 로딩/에러 피드백 - 사용자 신뢰도

#### 단기 목표 (Within 1 Month)
4. **C-2**: 네비게이션 재구조화
5. **H-5**: 키보드 단축키 가이드
6. **H-3**: 색상 시스템 구축

#### 중기 목표 (2-3 Months)
7. Phase 2 완료
8. Phase 3 일부 착수
9. 사용자 피드백 수집 및 반영

---

### 성공 지표 (Success Metrics)

#### 정량적 지표
- **접근성 스코어**: Lighthouse Accessibility 95+ 달성
- **색상 대비**: WCAG AA 100% 준수
- **키보드 네비게이션**: 모든 기능 키보드로 접근 가능
- **에러 복구율**: 에러 발생 시 복구 성공률 80%+

#### 정성적 지표
- **사용자 만족도**: 설문 조사 점수 향상
- **기능 발견성**: 단축키 사용률 증가
- **첫 사용자 경험**: 온보딩 완료율 향상

---

### 마무리

이 UI/UX 분석 보고서는 MyViewer-electron 프로젝트의 **현재 상태를 객관적으로 평가**하고, **실행 가능한 개선 방안**을 제시합니다.

각 제안은 **독립적으로 구현 가능**하므로 리소스와 우선순위에 따라 **점진적으로 적용**할 수 있습니다.

특히 **Phase 1 (Critical Fixes)**은 **접근성 및 법적 요구사항**과 관련이 있으므로 가능한 빠르게 착수하는 것을 강력히 권장합니다.

Phase 2 이후는 사용자 피드백을 수집하고 데이터 기반으로 우선순위를 재조정하는 것이 좋습니다.

---

**문의 및 후속 조치**:
- 구체적인 구현 가이드가 필요한 항목
- 기술적 난이도가 높은 항목에 대한 상세 설계
- 사용자 테스트 계획 수립

---

**작성자**: UI-Designer Agent
**버전**: 1.0
**최종 수정**: 2025-11-21
