# MyViewer UI/UX 개선 계획 - 시각 디자인

**작성일:** 2025-11-18
**버전:** 1.0
**우선순위:** 높음 (High)

## 목차

- [1. 디자인 시스템 구축](#1-디자인-시스템-구축)
- [2. 색상 팔레트](#2-색상-팔레트)
- [3. 타이포그래피](#3-타이포그래피)
- [4. 간격 시스템](#4-간격-시스템)
- [5. 컴포넌트 스타일](#5-컴포넌트-스타일)
- [6. 애니메이션](#6-애니메이션)

---

## 1. 디자인 시스템 구축

### 1.1 왜 필요한가?

**현재 문제:**
- 색상 값이 하드코딩되어 곳곳에 흩어져 있음
- 유사한 값이 중복 정의됨 (#444, #3d3d3d, #2d2d2d)
- 변경 시 모든 파일을 수정해야 함
- 일관성 유지 어려움

**디자인 시스템의 이점:**
- ✅ 일관된 시각적 언어
- ✅ 빠른 개발 속도
- ✅ 쉬운 유지보수
- ✅ 테마 전환 용이
- ✅ 협업 효율 향상

### 1.2 구현 방법

**CSS 변수 사용** (권장)

**파일:** `src/renderer/styles/design-tokens.css` (신규)

```css
:root {
  /* ============================================
     COLOR TOKENS
     ============================================ */

  /* Brand Colors */
  --color-primary: #007acc;
  --color-primary-hover: #005a9e;
  --color-primary-active: #004578;

  /* Neutral Colors (Dark Theme) */
  --color-bg-primary: #1e1e1e;
  --color-bg-secondary: #252525;
  --color-bg-tertiary: #2d2d2d;
  --color-bg-elevated: #333333;

  /* Surface Colors */
  --color-surface-default: #2d2d2d;
  --color-surface-hover: #3d3d3d;
  --color-surface-active: #444444;

  /* Text Colors */
  --color-text-primary: #ffffff;
  --color-text-secondary: #aaaaaa;
  --color-text-tertiary: #888888;
  --color-text-disabled: #666666;

  /* Border Colors */
  --color-border-default: #444444;
  --color-border-hover: #555555;
  --color-border-focus: var(--color-primary);

  /* Status Colors */
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-error: #f44336;
  --color-info: #2196f3;

  /* ============================================
     TYPOGRAPHY
     ============================================ */

  /* Font Family */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
                       'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  --font-family-mono: 'Courier New', Courier, monospace;

  /* Font Sizes */
  --font-size-xs: 0.75rem;      /* 12px */
  --font-size-sm: 0.875rem;     /* 14px */
  --font-size-base: 1rem;       /* 16px */
  --font-size-lg: 1.125rem;     /* 18px */
  --font-size-xl: 1.25rem;      /* 20px */
  --font-size-2xl: 1.5rem;      /* 24px */
  --font-size-3xl: 1.875rem;    /* 30px */

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line Heights */
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* ============================================
     SPACING
     ============================================ */

  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */

  /* ============================================
     BORDERS
     ============================================ */

  --border-width-thin: 1px;
  --border-width-medium: 2px;
  --border-width-thick: 4px;

  --border-radius-sm: 2px;
  --border-radius-base: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 8px;
  --border-radius-xl: 12px;
  --border-radius-full: 9999px;

  /* ============================================
     SHADOWS
     ============================================ */

  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.4),
                 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4),
               0 2px 4px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5),
               0 4px 6px -2px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5),
               0 10px 10px -5px rgba(0, 0, 0, 0.4);

  /* Focus Shadow */
  --shadow-focus: 0 0 0 3px rgba(0, 122, 204, 0.3);

  /* ============================================
     TRANSITIONS
     ============================================ */

  --transition-fast: 150ms ease-in-out;
  --transition-base: 200ms ease-in-out;
  --transition-slow: 300ms ease-in-out;

  /* ============================================
     Z-INDEX
     ============================================ */

  --z-index-dropdown: 1000;
  --z-index-sticky: 1020;
  --z-index-fixed: 1030;
  --z-index-modal-backdrop: 1040;
  --z-index-modal: 1050;
  --z-index-popover: 1060;
  --z-index-tooltip: 1070;
}
```

### 1.3 적용 방법

#### 1.3.1 CSS 파일에서

**기존:**
```css
.button {
  background: #444;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}
```

**개선:**
```css
.button {
  background: var(--color-surface-default);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--border-radius-base);
  transition: background var(--transition-base);
}

.button:hover {
  background: var(--color-surface-hover);
}
```

#### 1.3.2 React 인라인 스타일에서

**기존:**
```tsx
<div style={{
  background: '#2d2d2d',
  padding: '0.5rem',
  borderRadius: '4px',
}}>
```

**개선:**
```tsx
<div style={{
  background: 'var(--color-surface-default)',
  padding: 'var(--space-2)',
  borderRadius: 'var(--border-radius-base)',
}}>
```

#### 1.3.3 TypeScript 헬퍼 (선택 사항)

**파일:** `src/renderer/styles/tokens.ts` (신규)

```tsx
export const colors = {
  primary: 'var(--color-primary)',
  bgPrimary: 'var(--color-bg-primary)',
  textPrimary: 'var(--color-text-primary)',
  // ...
} as const;

export const spacing = {
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  // ...
} as const;

// 사용
import { colors, spacing } from '@renderer/styles/tokens';

<div style={{
  background: colors.bgPrimary,
  padding: spacing[4],
}}>
```

---

## 2. 색상 팔레트

### 2.1 현재 문제 분석

**중복 색상 발견:**

```css
/* 배경색 */
#1e1e1e (1회)
#252525 (2회)
#2d2d2d (15회) ⚠️
#3d3d3d (8회) ⚠️
#333333 (3회)
#444444 (12회) ⚠️

/* 텍스트 색상 */
#ffffff (20회)
#cccccc (5회)
#999999 (10회) ⚠️
#888888 (3회)

/* 액센트 색상 */
#007acc (5회)
#2da8ff (2회)
```

### 2.2 통합 색상 팔레트

#### Dark Theme (현재)

```css
/* 배경 레이어 */
--color-bg-app: #1e1e1e;          /* 앱 전체 배경 */
--color-bg-panel: #252525;        /* 사이드바, 패널 */
--color-bg-surface: #2d2d2d;      /* 카드, 버튼 기본 */
--color-bg-hover: #3d3d3d;        /* 호버 상태 */
--color-bg-active: #444444;       /* 활성화 상태 */

/* 텍스트 계층 */
--color-text-primary: #ffffff;    /* 주요 텍스트 */
--color-text-secondary: #aaaaaa;  /* 보조 텍스트 (대비 5.14:1) */
--color-text-tertiary: #888888;   /* 힌트, 레이블 */
--color-text-disabled: #666666;   /* 비활성 텍스트 */

/* 인터랙티브 */
--color-primary: #007acc;
--color-primary-light: #2da8ff;
--color-primary-dark: #005a9e;
```

#### Light Theme (미래 확장)

```css
[data-theme="light"] {
  --color-bg-app: #ffffff;
  --color-bg-panel: #f5f5f5;
  --color-bg-surface: #ffffff;
  --color-bg-hover: #f0f0f0;
  --color-bg-active: #e0e0e0;

  --color-text-primary: #000000;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;
  --color-text-disabled: #cccccc;

  --color-primary: #0066cc;
}
```

### 2.3 색상 사용 가이드

| 용도 | 색상 변수 | 예시 |
|------|----------|------|
| 앱 배경 | `--color-bg-app` | body, #root |
| 사이드바 배경 | `--color-bg-panel` | FolderSidebar |
| 버튼 기본 | `--color-bg-surface` | button, .card |
| 버튼 호버 | `--color-bg-hover` | button:hover |
| 버튼 활성 | `--color-bg-active` | button:active, .active |
| 제목 | `--color-text-primary` | h1, h2, 중요 텍스트 |
| 본문 | `--color-text-secondary` | p, span, 일반 텍스트 |
| 레이블 | `--color-text-tertiary` | label, hint |
| 액션 버튼 | `--color-primary` | CTA, 링크 |
| 성공 메시지 | `--color-success` | 완료, 성공 |
| 경고 | `--color-warning` | 주의 필요 |
| 에러 | `--color-error` | 실패, 오류 |

---

## 3. 타이포그래피

### 3.1 현재 문제

**불일치하는 폰트 크기:**
```css
1.3125rem (21px)  - 사용처 불명
1.275rem  (20.4px) - 어색한 값
1.2rem    (19.2px) - NavigationBar
1.125rem  (18px)   - 일부 버튼
1rem      (16px)   - 기본
0.875rem  (14px)   - 작은 텍스트
0.75rem   (12px)   - 최소 크기
```

### 3.2 타이포그래피 스케일

**8pt 그리드 기반:**

```css
--font-size-xs:   0.75rem;   /* 12px - 최소 크기 */
--font-size-sm:   0.875rem;  /* 14px - 작은 텍스트 */
--font-size-base: 1rem;      /* 16px - 기본 */
--font-size-lg:   1.125rem;  /* 18px - 큰 텍스트 */
--font-size-xl:   1.25rem;   /* 20px - 부제목 */
--font-size-2xl:  1.5rem;    /* 24px - 제목 */
--font-size-3xl:  1.875rem;  /* 30px - 대제목 */
```

### 3.3 타이포그래피 컴포넌트

**파일:** `src/renderer/styles/typography.css` (신규)

```css
/* Headings */
h1, .heading-1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4) 0;
}

h2, .heading-2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

h3, .heading-3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

/* Body Text */
p, .body-text {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-4) 0;
}

.body-small {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text-secondary);
}

.caption {
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
  color: var(--color-text-tertiary);
}

/* Labels */
.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);
  color: var(--color-text-secondary);
}

/* Code */
code, .code {
  font-family: var(--font-family-mono);
  font-size: 0.875em;
  background: var(--color-bg-surface);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}
```

### 3.4 사용 가이드

| 요소 | 클래스 | 용도 |
|------|--------|------|
| 페이지 제목 | `.heading-1` | 메인 헤더 |
| 섹션 제목 | `.heading-2` | 사이드바 제목 |
| 서브 섹션 | `.heading-3` | 탭 레이블 |
| 본문 | `.body-text` | 설명, 메시지 |
| 작은 텍스트 | `.body-small` | 힌트, 부가 정보 |
| 캡션 | `.caption` | 이미지 캡션, 타임스탬프 |
| 레이블 | `.label` | 폼 레이블 |

---

## 4. 간격 시스템

### 4.1 8pt 그리드 시스템

**기준:** 8px (0.5rem) 단위

```css
--space-1: 0.25rem;   /* 4px  - 아주 작은 간격 */
--space-2: 0.5rem;    /* 8px  - 기본 최소 단위 */
--space-3: 0.75rem;   /* 12px - 작은 간격 */
--space-4: 1rem;      /* 16px - 중간 간격 */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px - 큰 간격 */
--space-8: 2rem;      /* 32px - 섹션 간격 */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px - 매우 큰 간격 */
```

### 4.2 간격 사용 가이드

| 용도 | 간격 | 변수 |
|------|------|------|
| 아이콘과 텍스트 | 4px | `--space-1` |
| 버튼 내부 padding | 8px 16px | `--space-2` `--space-4` |
| 리스트 아이템 간격 | 8px | `--space-2` |
| 카드 내부 padding | 16px | `--space-4` |
| 폼 필드 간격 | 12px | `--space-3` |
| 섹션 여백 | 24px | `--space-6` |
| 페이지 여백 | 32px | `--space-8` |

### 4.3 적용 예시

```css
/* 버튼 */
.button {
  padding: var(--space-2) var(--space-4);
  gap: var(--space-1); /* 아이콘-텍스트 간격 */
  margin-bottom: var(--space-2);
}

/* 카드 */
.card {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

/* 섹션 */
.section {
  padding: var(--space-6) var(--space-8);
  margin-bottom: var(--space-8);
}
```

---

## 5. 컴포넌트 스타일

### 5.1 버튼 시스템

**파일:** `src/renderer/styles/button.css` (신규)

```css
/* Base Button */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);

  border: var(--border-width-thin) solid transparent;
  border-radius: var(--border-radius-base);

  cursor: pointer;
  user-select: none;
  transition: all var(--transition-base);
}

/* Primary Button */
.button-primary {
  background: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.button-primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-base);
}

.button-primary:active {
  background: var(--color-primary-active);
  transform: translateY(0);
  box-shadow: none;
}

/* Secondary Button */
.button-secondary {
  background: var(--color-surface-default);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.button-secondary:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

/* Ghost Button */
.button-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}

.button-ghost:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

/* Icon Button */
.button-icon {
  padding: var(--space-2);
  aspect-ratio: 1;
}

/* Button Sizes */
.button-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
}

.button-lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-lg);
}

/* Button States */
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.button:focus-visible {
  outline: var(--border-width-medium) solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: var(--shadow-focus);
}
```

### 5.2 카드 시스템

```css
.card {
  background: var(--color-surface-default);
  border: var(--border-width-thin) solid var(--color-border-default);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.card:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-base);
  transform: translateY(-2px);
}

.card-interactive {
  cursor: pointer;
}

.card-interactive:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}
```

### 5.3 입력 필드

```css
.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);

  background: var(--color-surface-default);
  color: var(--color-text-primary);
  border: var(--border-width-thin) solid var(--color-border-default);
  border-radius: var(--border-radius-base);

  transition: all var(--transition-base);
}

.input:hover {
  border-color: var(--color-border-hover);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.input::placeholder {
  color: var(--color-text-tertiary);
}
```

---

## 6. 애니메이션

### 6.1 전환 시스템

```css
/* Duration */
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;

/* Easing */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
```

### 6.2 애니메이션 패턴

#### Fade In

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fade-in {
  animation: fadeIn var(--transition-base) var(--ease-out);
}
```

#### Slide In

```css
@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.slide-in-up {
  animation: slideInUp var(--transition-slow) var(--ease-out);
}
```

#### Scale

```css
@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.scale-in {
  animation: scaleIn var(--transition-base) var(--ease-out);
}
```

### 6.3 적용 예시

```tsx
// 모달 등장
<div className="modal fade-in">
  {/* 내용 */}
</div>

// 썸네일 로딩
<div className="thumbnail scale-in">
  <img src={src} alt={alt} />
</div>

// 페이지 전환
<div className="slide-in-up">
  <ImageViewer />
</div>
```

---

## 7. 구현 체크리스트

### Phase 1: 토큰 정의 (2시간)
- [ ] `design-tokens.css` 파일 생성
- [ ] 색상 변수 정의
- [ ] 타이포그래피 변수 정의
- [ ] 간격 변수 정의
- [ ] 그림자 변수 정의

### Phase 2: 기존 코드 마이그레이션 (6시간)
- [ ] `index.css`를 토큰으로 변경
- [ ] NavigationBar 스타일 변경
- [ ] FolderSidebar 스타일 변경
- [ ] BottomThumbnails 스타일 변경
- [ ] ImageViewer 스타일 변경

### Phase 3: 컴포넌트 스타일 구축 (4시간)
- [ ] `button.css` 생성
- [ ] `card.css` 생성
- [ ] `input.css` 생성
- [ ] 기존 버튼들을 클래스 기반으로 변경

### Phase 4: 애니메이션 추가 (2시간)
- [ ] 애니메이션 키프레임 정의
- [ ] 페이지 전환 애니메이션
- [ ] 모달 애니메이션
- [ ] 썸네일 로딩 애니메이션

---

**다음 단계:** [UI-UX-COMPONENTS.md](./UI-UX-COMPONENTS.md)에서 각 컴포넌트별 상세 개선 사항을 확인하세요.
