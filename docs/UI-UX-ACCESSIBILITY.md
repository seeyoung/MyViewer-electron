# MyViewer UI/UX 개선 계획 - 접근성

**작성일:** 2025-11-18
**버전:** 1.0
**우선순위:** 긴급 (Critical)

## 목차

- [1. 접근성 개요](#1-접근성-개요)
- [2. 색상 대비 개선](#2-색상-대비-개선)
- [3. ARIA 레이블 추가](#3-aria-레이블-추가)
- [4. 키보드 네비게이션](#4-키보드-네비게이션)
- [5. 스크린 리더 지원](#5-스크린-리더-지원)
- [6. 검증 방법](#6-검증-방법)

---

## 1. 접근성 개요

### 1.1 왜 중요한가?

**법적 요구사항:**
- 미국: ADA (Americans with Disabilities Act), Section 508
- 유럽: EAA (European Accessibility Act)
- 한국: 장애인차별금지법

**윤리적 책임:**
- 전 세계 인구의 15% (10억 명)가 장애를 가지고 있음
- 누구나 접근 가능한 소프트웨어 제공이 목표

**비즈니스 이점:**
- 더 넓은 사용자층
- SEO 개선
- 더 나은 사용성 (모든 사용자에게 혜택)

### 1.2 현재 문제점 요약

| 문제 | 심각도 | WCAG 기준 | 상태 |
|------|--------|-----------|------|
| 색상 대비 부족 | 높음 | 1.4.3 (AA) | ❌ 미달 |
| ARIA 레이블 누락 | 높음 | 4.1.2 (A) | ❌ 미달 |
| 키보드 포커스 불명확 | 중간 | 2.4.7 (AA) | ⚠️ 부분 |
| 스크린 리더 미지원 | 높음 | 4.1.3 (AA) | ❌ 미달 |
| 동적 콘텐츠 알림 없음 | 중간 | 4.1.3 (AA) | ❌ 미달 |

### 1.3 목표

- ✅ **WCAG 2.1 Level AA 기준 충족**
- ✅ 키보드만으로 모든 기능 접근 가능
- ✅ 스크린 리더 완전 지원
- ✅ 색상 대비 4.5:1 이상

---

## 2. 색상 대비 개선

### 2.1 현재 문제

**위치:** `src/renderer/index.css` 및 인라인 스타일

**측정 결과:**

| 요소 | 전경색 | 배경색 | 대비율 | 기준 | 결과 |
|------|--------|--------|--------|------|------|
| .page-counter | #999 | #2d2d2d | 4.36:1 | 4.5:1 | ❌ 미달 |
| .folder-tree 비활성 | #999 | #2d2d2d | 4.36:1 | 4.5:1 | ❌ 미달 |
| button disabled | rgba(255,255,255,0.3) | #444 | ~3.8:1 | 4.5:1 | ❌ 미달 |
| .thumbnail loading | #ccc | #2d2d2d | 6.68:1 | 4.5:1 | ✅ 통과 |

**도구:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### 2.2 해결 방법

#### 방법 1: 색상 밝기 조정 (권장)

**파일:** `src/renderer/index.css`

```css
/* 변경 전 */
.page-counter {
  color: #999; /* 대비율 4.36:1 */
}

/* 변경 후 */
.page-counter {
  color: #aaa; /* 대비율 5.14:1 ✅ */
}
```

#### 방법 2: 배경색 어둡게 조정

```css
/* 변경 전 */
.nav-bar {
  background: #2d2d2d;
  color: #999;
}

/* 변경 후 */
.nav-bar {
  background: #222; /* 더 어두운 배경 */
  color: #999; /* 대비율 5.24:1 ✅ */
}
```

### 2.3 수정 대상 파일 및 코드

#### 2.3.1 index.css

**라인:** ~60-70

```css
/* 수정 전 */
.page-counter {
  font-size: 1.2rem;
  font-weight: 600;
  color: #999; /* ❌ */
}

/* 수정 후 */
.page-counter {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-secondary); /* CSS 변수 사용 */
  /* 또는 */
  color: #aaa; /* ✅ 대비율 5.14:1 */
}
```

#### 2.3.2 NavigationBar.tsx

**라인:** ~250-260 (페이지 카운터)

```tsx
// 수정 전
<div style={{
  fontSize: '1.2rem',
  fontWeight: 600,
  color: '#999', // ❌
}}>
  {currentPageIndex + 1} / {totalPages}
</div>

// 수정 후
<div style={{
  fontSize: '1.2rem',
  fontWeight: 600,
  color: '#aaa', // ✅
}}>
  {currentPageIndex + 1} / {totalPages}
</div>
```

#### 2.3.3 FolderSidebar.tsx

**라인:** ~200-220 (폴더 아이템)

```tsx
// 수정 전
<div style={{
  color: isActive ? '#fff' : '#999', // ❌
}}>
  {folder.name}
</div>

// 수정 후
<div style={{
  color: isActive ? '#fff' : '#aaa', // ✅
}}>
  {folder.name}
</div>
```

### 2.4 체크리스트

- [ ] `index.css`의 모든 색상 검증
- [ ] NavigationBar 인라인 스타일 수정
- [ ] FolderSidebar 색상 수정
- [ ] BottomThumbnails 색상 검증
- [ ] ImageViewer 오버레이 색상 검증
- [ ] 대비 검사 도구로 재검증
- [ ] 다크 모드에서 시각적 확인

---

## 3. ARIA 레이블 추가

### 3.1 현재 문제

**스크린 리더 사용자가 듣게 되는 내용:**

```
"Button"  (Previous 버튼)
"Button"  (Next 버튼)
"Button"  (Zoom in 버튼)
"Button"  (Zoom out 버튼)
```

→ 버튼의 용도를 알 수 없음!

### 3.2 ARIA 기본 규칙

1. **aria-label**: 시각적 레이블이 없는 경우
2. **aria-labelledby**: 다른 요소를 레이블로 참조
3. **aria-describedby**: 추가 설명 제공
4. **role**: 요소의 역할 명시 (semantic HTML 우선)

### 3.3 수정 대상 컴포넌트

#### 3.3.1 NavigationBar.tsx

**라인:** ~100-300 (모든 버튼)

```tsx
// 수정 전 ❌
<button
  onClick={handlePrevious}
  disabled={currentPageIndex === 0}
  style={buttonStyle}
>
  Previous
</button>

// 수정 후 ✅
<button
  onClick={handlePrevious}
  disabled={currentPageIndex === 0}
  style={buttonStyle}
  aria-label="Go to previous page"
  aria-disabled={currentPageIndex === 0}
>
  Previous
</button>
```

**모든 버튼에 추가할 aria-label:**

```tsx
// 네비게이션
<button aria-label="Go to previous page">Previous</button>
<button aria-label="Go to next page">Next</button>
<button aria-label="Go to first page">First</button>
<button aria-label="Go to last page">Last</button>

// 줌 컨트롤
<button aria-label="Zoom in">🔍+</button>
<button aria-label="Zoom out">🔍-</button>
<button aria-label="Reset zoom to 100%">100%</button>

// 핏 모드
<button aria-label="Fit to width">↔ Fit Width</button>
<button aria-label="Fit to height">↕ Fit Height</button>
<button aria-label="Actual size (1:1)">1:1</button>
<button aria-label="Custom zoom">Custom</button>

// 기타
<button aria-label="Toggle fullscreen mode">Fullscreen</button>
<button aria-label="Toggle folder sidebar">Folder</button>
<button aria-label="Start auto slideshow">▶ Auto Slide</button>
```

#### 3.3.2 FolderSidebar.tsx

**탭 버튼:**

```tsx
// 수정 전 ❌
<button
  onClick={() => setActiveTab('folders')}
  style={tabButtonStyle}
>
  Folders
</button>

// 수정 후 ✅
<button
  onClick={() => setActiveTab('folders')}
  style={tabButtonStyle}
  role="tab"
  aria-selected={activeTab === 'folders'}
  aria-controls="folders-panel"
>
  Folders
</button>

// 탭 패널
<div
  id="folders-panel"
  role="tabpanel"
  aria-labelledby="folders-tab"
>
  {/* 폴더 트리 */}
</div>
```

**폴더 아이템:**

```tsx
// 수정 후 ✅
<div
  onClick={() => handleFolderClick(folder)}
  role="button"
  tabIndex={0}
  aria-label={`Folder: ${folder.name}, ${folder.totalImages} images`}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleFolderClick(folder);
    }
  }}
>
  {folder.name}
</div>
```

#### 3.3.3 BottomThumbnails.tsx

**썸네일 아이템:**

```tsx
// 수정 전 ❌
<div
  onClick={() => onThumbnailClick(index)}
  style={thumbnailStyle}
>
  <img src={thumbnail} alt="" />
</div>

// 수정 후 ✅
<button
  onClick={() => onThumbnailClick(index)}
  style={thumbnailStyle}
  aria-label={`Go to page ${index + 1}`}
  aria-current={index === currentIndex ? 'true' : 'false'}
>
  <img
    src={thumbnail}
    alt={`Thumbnail of page ${index + 1}`}
  />
</button>
```

#### 3.3.4 ImageViewer.tsx

**메인 이미지:**

```tsx
// 수정 후 ✅
<Image
  image={image}
  alt={`Page ${currentPageIndex + 1} of ${totalPages}`}
/>

// Konva Stage
<Stage
  role="img"
  aria-label={`Image viewer: Page ${currentPageIndex + 1}`}
>
  {/* ... */}
</Stage>
```

### 3.4 체크리스트

- [ ] NavigationBar 모든 버튼에 aria-label
- [ ] FolderSidebar 탭에 role="tab" 추가
- [ ] 폴더 아이템에 role="button" 추가
- [ ] 썸네일에 aria-label 및 aria-current
- [ ] ImageViewer에 alt 텍스트
- [ ] 스크린 리더로 테스트 (NVDA, JAWS, VoiceOver)

---

## 4. 키보드 네비게이션

### 4.1 현재 상태

**구현된 단축키** (`src/renderer/hooks/useKeyboardShortcuts.ts`):
- ✅ 방향키: 이미지 탐색
- ✅ Home/End: 처음/마지막 페이지
- ✅ +/-: 줌 인/아웃
- ✅ F11: 풀스크린

**문제점:**
- ❌ 포커스 표시가 불명확
- ❌ Tab 키로 UI 요소 탐색 어려움
- ❌ 포커스 트랩 미구현 (모달/오버레이)

### 4.2 포커스 스타일 개선

#### 4.2.1 전역 스타일 추가

**파일:** `src/renderer/index.css`

```css
/* 현재 스타일 */
*:focus {
  outline: none; /* ❌ 접근성 문제! */
}

/* 개선된 스타일 ✅ */
*:focus {
  outline: 2px solid transparent; /* 기본은 숨김 */
}

*:focus-visible {
  outline: 2px solid #007acc; /* 키보드 사용 시 표시 */
  outline-offset: 2px;
  border-radius: 4px;
}

/* 버튼 포커스 */
button:focus-visible {
  outline: 2px solid #007acc;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0, 122, 204, 0.2);
}

/* 입력 필드 포커스 */
input:focus-visible,
select:focus-visible {
  outline: 2px solid #007acc;
  border-color: #007acc;
}
```

### 4.3 Tab 순서 최적화

#### 4.3.1 tabindex 사용 지침

```tsx
// 자연스러운 Tab 순서 (tabindex 불필요)
<button>First</button>
<button>Second</button>

// 커스텀 요소에만 tabindex 추가
<div
  role="button"
  tabIndex={0}  // ✅ 포커스 가능
  onClick={handler}
>
  Custom Button
</div>

// 포커스 제외 (주의해서 사용)
<div tabIndex={-1}>Not focusable</div>

// ❌ 잘못된 사용 (Tab 순서 혼란)
<button tabIndex={3}>Third</button>
<button tabIndex={1}>First</button>
<button tabIndex={2}>Second</button>
```

#### 4.3.2 권장 Tab 순서

```
1. Header (Open Archive 버튼)
2. Recent Files (Chip 버튼들)
3. Navigation Bar (왼쪽 → 오른쪽)
   - Previous
   - Page Input
   - Next
   - Zoom Controls
   - Fit Mode
   - Fullscreen
4. Folder Sidebar (활성화 시)
   - Tab 버튼
   - 폴더 목록
5. Main Image Viewer (canvas)
6. Bottom Thumbnails (활성화 시)
```

### 4.4 포커스 트랩 구현

**사용 사례:** 모달, 드롭다운, 오버레이

#### 4.4.1 useFocusTrap 훅 생성

**파일:** `src/renderer/hooks/useFocusTrap.ts` (신규)

```tsx
import { useEffect, useRef } from 'react';

export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [active]);

  return containerRef;
}
```

#### 4.4.2 사용 예시

```tsx
// NavigationBar의 Auto Slide 오버레이
const AutoSlideOverlay = ({ onClose }) => {
  const trapRef = useFocusTrap(true);

  return (
    <div ref={trapRef} role="dialog" aria-modal="true">
      <button onClick={onClose}>Close</button>
      {/* 다른 컨트롤들 */}
    </div>
  );
};
```

### 4.5 체크리스트

- [ ] 전역 :focus-visible 스타일 추가
- [ ] 모든 interactive 요소에 tabindex 확인
- [ ] Tab 순서 테스트 (키보드만으로)
- [ ] useFocusTrap 훅 구현
- [ ] 모달/오버레이에 포커스 트랩 적용
- [ ] Escape 키로 모달 닫기 구현

---

## 5. 스크린 리더 지원

### 5.1 동적 콘텐츠 알림

#### 5.1.1 aria-live 영역 추가

**파일:** `src/renderer/App.tsx`

```tsx
// 수정 후 ✅
function App() {
  const [announcement, setAnnouncement] = useState('');

  // 페이지 변경 시 알림
  useEffect(() => {
    if (currentPageIndex !== null) {
      setAnnouncement(`Page ${currentPageIndex + 1} of ${totalPages}`);
    }
  }, [currentPageIndex, totalPages]);

  return (
    <div>
      {/* 스크린 리더 전용 알림 영역 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {announcement}
      </div>

      {/* 기존 UI */}
    </div>
  );
}
```

#### 5.1.2 알림 시나리오

```tsx
// 이미지 로딩
setAnnouncement('Loading image...');

// 이미지 로딩 완료
setAnnouncement('Image loaded successfully');

// 에러 발생
setAnnouncement('Error: Failed to load image');

// 줌 변경
setAnnouncement(`Zoom level changed to ${zoomLevel * 100}%`);

// 북마크 추가
setAnnouncement('Bookmark added');

// 풀스크린 진입
setAnnouncement('Entered fullscreen mode. Press F11 to exit.');
```

### 5.2 랜드마크 영역 정의

**파일:** `src/renderer/App.tsx`

```tsx
<div>
  <header role="banner">
    {/* 헤더 */}
  </header>

  <nav role="navigation" aria-label="Main navigation">
    <NavigationBar />
  </nav>

  <aside role="complementary" aria-label="Folder navigation">
    <FolderSidebar />
  </aside>

  <main role="main" aria-label="Image viewer">
    <ImageViewer />
  </main>

  <aside role="complementary" aria-label="Thumbnail strip">
    <BottomThumbnails />
  </aside>
</div>
```

### 5.3 체크리스트

- [ ] aria-live 영역 추가
- [ ] 주요 이벤트에 알림 추가
- [ ] 랜드마크 역할 정의
- [ ] 스크린 리더 테스트
  - [ ] NVDA (Windows)
  - [ ] JAWS (Windows)
  - [ ] VoiceOver (macOS)

---

## 6. 검증 방법

### 6.1 자동화 도구

#### 6.1.1 axe DevTools

```bash
# Chrome Extension 설치
https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnindnejefpokejbdd

# 검사 실행
1. DevTools 열기 (F12)
2. axe DevTools 탭 선택
3. "Scan ALL of my page" 클릭
4. 발견된 이슈 검토
```

#### 6.1.2 Lighthouse

```bash
# Chrome DevTools에서 실행
1. DevTools 열기 (F12)
2. Lighthouse 탭
3. Categories: Accessibility 선택
4. "Analyze page load" 클릭

# 목표: 90점 이상
```

### 6.2 수동 테스트

#### 6.2.1 키보드 네비게이션

```
체크리스트:
□ Tab 키로 모든 버튼/링크 접근 가능
□ Enter/Space로 버튼 활성화
□ 방향키로 이미지 탐색
□ Escape로 모달 닫기
□ 포커스 표시가 명확함
```

#### 6.2.2 스크린 리더

```
NVDA (Windows):
1. NVDA 시작 (Ctrl+Alt+N)
2. 애플리케이션 열기
3. Tab 키로 탐색하며 읽어주는 내용 확인
4. 모든 버튼의 용도가 명확한지 확인

VoiceOver (macOS):
1. VoiceOver 시작 (Cmd+F5)
2. VO+Right Arrow로 탐색
3. 랜드마크 이동 (VO+U)
```

#### 6.2.3 색상 대비

```
WebAIM Contrast Checker:
https://webaim.org/resources/contrastchecker/

모든 텍스트 조합 검증:
□ 일반 텍스트: 4.5:1 이상
□ 큰 텍스트 (18pt+): 3:1 이상
□ UI 컴포넌트: 3:1 이상
```

### 6.3 체크리스트 전체

```markdown
## WCAG 2.1 Level AA 체크리스트

### Perceivable (인식 가능)
- [ ] 1.1.1 모든 이미지에 alt 텍스트
- [ ] 1.4.3 색상 대비 4.5:1 이상
- [ ] 1.4.11 UI 컴포넌트 대비 3:1 이상

### Operable (작동 가능)
- [ ] 2.1.1 키보드로 모든 기능 접근
- [ ] 2.1.2 키보드 트랩 없음
- [ ] 2.4.3 논리적 Tab 순서
- [ ] 2.4.7 포커스 표시 명확

### Understandable (이해 가능)
- [ ] 3.2.1 포커스 시 예상치 못한 변화 없음
- [ ] 3.3.1 에러 메시지 명확
- [ ] 3.3.3 에러 복구 제안

### Robust (견고함)
- [ ] 4.1.2 모든 UI에 name, role, value
- [ ] 4.1.3 상태 메시지 전달 (aria-live)
```

---

**다음 단계:** [UI-UX-VISUAL-DESIGN.md](./UI-UX-VISUAL-DESIGN.md)에서 디자인 시스템을 구축하세요.
