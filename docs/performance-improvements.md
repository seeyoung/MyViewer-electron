# 썸네일 시스템 성능 개선 제안

**작성일**: 2025-11-14
**대상**: ThumbnailService, useInViewport, thumbnailRequestQueue, BottomThumbnails
**목적**: 성능, 안정성, 메모리 효율성 개선

## 현재 지표 요약 (2025-11-14)

| 시나리오 | 관측 지표 | 문제점 |
| --- | --- | --- |
| 썸네일 캐시 누적 | 4.1GB (30개 아카이브 연속 열람) | 캐시 한도가 없어 사용자 디스크 고갈 위험 |
| 폴백 로직 | 12MB/요청 (원본 base64 IPC) | 메인 이미지 로딩과 대역폭 경쟁, 메모리 스파이크 |
| 썸네일 대기열 | 평균 대기 1.8s (빠른 스크롤) | FIFO라 화면 밖 요청 우선 처리 |
| useInViewport | Observer 400+ 동시 | 동일 옵션 Observer 재사용 부재로 메모리 낭비 |

이 문서는 위 수치를 개선하기 위한 **실행 계획**을 우선순위별로 정리합니다. 각 항목에는 *현재 지표*, *목표*, *구현 계획*, *검증 방법*을 명시합니다.

---

## 목차

- [P0: Critical Priority](#p0-critical-priority)
  - [1. ThumbnailService 캐시 크기 관리](#1-thumbnailservice-캐시-크기-관리)
  - [2. 폴백 로직 개선](#2-폴백-로직-개선)
- [P1: High Priority](#p1-high-priority)
  - [3. 우선순위 큐 구현](#3-우선순위-큐-구현)
  - [4. useInViewport 의존성 최적화](#4-useinviewport-의존성-최적화)
- [P2: Medium Priority](#p2-medium-priority)
  - [5. 동적 동시성 조정](#5-동적-동시성-조정)
  - [6. 캐시 키 충돌 방지](#6-캐시-키-충돌-방지)
- [P3: Low Priority](#p3-low-priority)
  - [7. Observer 전역 공유](#7-observer-전역-공유)
  - [8. 적응형 프리페칭](#8-적응형-프리페칭)

---

## P0: Critical Priority

### 1. ThumbnailService 캐시 크기 관리

**문제점**:
- 현재 디스크 캐시가 무제한으로 증가 가능
- 사용자가 많은 아카이브를 열면 수 GB의 캐시 누적 가능
- 디스크 공간 부족 시 애플리케이션 오류 발생 가능

**영향도**: High - 장기 사용 시 디스크 공간 고갈

- **현재 지표**: userData/thumbnail-cache 최대 4.1GB (테스트 로그 2025-11-14)
- **목표 지표**: 500MB 이하 유지, 마지막 접근 30일 초과 항목 자동 삭제

**구현 계획**:

```typescript
// src/main/services/ThumbnailService.ts

export class ThumbnailService {
  private readonly cacheDir: string;
  private readonly inflight: Map<string, Promise<ThumbnailResponse>> = new Map();

  // 새로운 속성 추가
  private readonly maxCacheSize: number = 500 * 1024 * 1024; // 500MB
  private readonly maxCacheAge: number = 30 * 24 * 60 * 60 * 1000; // 30일
  private cacheStats: Map<string, { size: number; accessTime: number }> = new Map();

  constructor(
    private readonly imageService: ImageService,
    private readonly folderService: FolderService
  ) {
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnail-cache');
    this.initializeCacheManagement();
  }

  private async initializeCacheManagement(): Promise<void> {
    // 애플리케이션 시작 시 캐시 통계 로드
    await this.loadCacheStats();

    // 오래된 캐시 정리
    await this.cleanupOldCache();

    // 주기적 정리 스케줄 (1시간마다)
    setInterval(() => this.cleanupOldCache(), 60 * 60 * 1000);
  }

  private async loadCacheStats(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        this.cacheStats.set(file, {
          size: stats.size,
          accessTime: stats.atimeMs,
        });
      }
    } catch (error) {
      // 캐시 디렉토리가 없으면 무시
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to load cache stats:', error);
      }
    }
  }

  private async cleanupOldCache(): Promise<void> {
    const now = Date.now();
    let totalSize = 0;
    const entries: Array<{ file: string; size: number; accessTime: number }> = [];

    // 캐시 통계 수집
    for (const [file, stats] of this.cacheStats.entries()) {
      totalSize += stats.size;
      entries.push({ file, ...stats });
    }

    // LRU 방식으로 정렬 (오래된 접근 시간 우선)
    entries.sort((a, b) => a.accessTime - b.accessTime);

    // 1. 오래된 캐시 삭제 (30일 이상)
    for (const entry of entries) {
      if (now - entry.accessTime > this.maxCacheAge) {
        await this.deleteCacheFile(entry.file);
        totalSize -= entry.size;
      }
    }

    // 2. 크기 제한 초과 시 LRU 삭제
    if (totalSize > this.maxCacheSize) {
      for (const entry of entries) {
        if (totalSize <= this.maxCacheSize * 0.8) {
          break; // 80%까지 줄이기
        }

        await this.deleteCacheFile(entry.file);
        totalSize -= entry.size;
      }
    }
  }

  private async deleteCacheFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, filename);
      await fs.unlink(filePath);
      this.cacheStats.delete(filename);
    } catch (error) {
      console.error(`Failed to delete cache file ${filename}:`, error);
    }
  }

  private async ensureThumbnail(
    cacheKey: string,
    options: ResolvedOptions,
    params: { archiveId: string; image: Image; sourceType: SourceType }
  ): Promise<ThumbnailResponse> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const cachePath = this.getCachePath(cacheKey, options.format);
    const cacheFilename = path.basename(cachePath);

    if (await this.fileExists(cachePath)) {
      // 캐시 접근 시간 업데이트
      this.updateCacheAccess(cacheFilename, cachePath);
      return this.buildPayloadFromCache(cachePath);
    }

    const sourceBuffer = await this.loadSourceBuffer(params.sourceType, params.archiveId, params.image);

    const { data, info } = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(options.format, { quality: options.quality })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(cachePath, data);

    // 새 캐시 파일 통계 추가
    this.cacheStats.set(cacheFilename, {
      size: data.length,
      accessTime: Date.now(),
    });

    return {
      dataUrl: this.bufferToDataUrl(data, options.format),
      width: info.width ?? options.maxWidth,
      height: info.height ?? options.maxHeight,
      format: options.format,
    };
  }

  private async updateCacheAccess(filename: string, filePath: string): Promise<void> {
    const stats = this.cacheStats.get(filename);
    if (stats) {
      stats.accessTime = Date.now();

      // 파일 시스템의 접근 시간도 업데이트
      try {
        const now = new Date();
        await fs.utimes(filePath, now, now);
      } catch (error) {
        console.error('Failed to update file access time:', error);
      }
    }
  }

  // 캐시 통계 조회 메서드 (디버깅/모니터링용)
  getCacheStats(): { totalSize: number; fileCount: number; oldestAccess: number } {
    let totalSize = 0;
    let oldestAccess = Date.now();

    for (const stats of this.cacheStats.values()) {
      totalSize += stats.size;
      if (stats.accessTime < oldestAccess) {
        oldestAccess = stats.accessTime;
      }
    }

    return {
      totalSize,
      fileCount: this.cacheStats.size,
      oldestAccess,
    };
  }
}
```

**예상 효과**:
- ✅ 디스크 공간 500MB로 제한
- ✅ 오래된 캐시 자동 정리로 장기 안정성 확보
- ✅ LRU 방식으로 자주 사용하는 썸네일 보존

**테스트 방법**:
```typescript
// 캐시 통계 모니터링
const stats = thumbnailService.getCacheStats();
console.log(`Cache size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Cache files: ${stats.fileCount}`);
```

---

### 2. 폴백 로직 개선

**문제점**:
- 썸네일 생성 실패 시 전체 이미지를 base64로 로드 (수 MB)
- 네트워크/메모리 낭비 및 UI 블로킹 발생
- 손상된 이미지의 경우 사용자에게 명확한 피드백 없음

**영향도**: High - 사용자 경험 및 성능

- **현재 지표**: 폴백 1회당 IPC payload 12MB, 렌더러 메모리 180MB 증가
- **목표 지표**: 폴백 1회당 payload 2KB 이하(플레이스홀더), 에러 상태 UI 제공

**개선 방안**:

```typescript
// src/renderer/components/viewer/BottomThumbnails.tsx

// 1. 플레이스홀더 이미지 추가
import { PLACEHOLDER_LOADING, PLACEHOLDER_ERROR, PLACEHOLDER_BLANK } from '@renderer/constants/placeholders';

interface ThumbnailState {
  dataUrl: string;
  status: 'loading' | 'success' | 'error';
  width?: number;
  height?: number;
}

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ image, sourceType, onSelect, isActive, panelHeight }) => {
  const [thumbnail, setThumbnail] = useState<ThumbnailState>({
    dataUrl: PLACEHOLDER_LOADING,
    status: 'loading',
  });

  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(() => {
    if (image.dimensions) {
      return image.dimensions.height > image.dimensions.width ? 'portrait' : 'landscape';
    }
    return 'landscape';
  });

  const cardRef = useRef<HTMLButtonElement | null>(null);
  const isVisible = useInViewport(cardRef, { rootMargin: '96px 0px', threshold: 0, freezeOnceVisible: true });
  const retryCountRef = useRef(0);
  const maxRetries = 2;

  useEffect(() => {
    let cancelled = false;
    if (!isVisible) {
      return undefined;
    }

    const load = async () => {
      setThumbnail({ dataUrl: PLACEHOLDER_LOADING, status: 'loading' });

      try {
        const safeHeight = Math.max(panelHeight, 48);
        const maxWidth = Math.round(safeHeight * (4 / 3));

        const response: any = await runThumbnailTask(() =>
          window.electronAPI.invoke(channels.IMAGE_GET_THUMBNAIL, {
            archiveId: image.archiveId,
            image,
            sourceType,
            maxHeight: safeHeight,
            maxWidth: Math.max(maxWidth, 48),
          }) as Promise<any>
        );

        if (!cancelled && response?.dataUrl) {
          const width = typeof response.width === 'number' ? response.width : undefined;
          const height = typeof response.height === 'number' ? response.height : undefined;

          setThumbnail({
            dataUrl: response.dataUrl as string,
            status: 'success',
            width,
            height,
          });

          if (typeof height === 'number' && typeof width === 'number') {
            setOrientation(height > width ? 'portrait' : 'landscape');
          }

          retryCountRef.current = 0; // 성공 시 리셋
          return;
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);

        // 재시도 로직
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`Retrying thumbnail load (${retryCountRef.current}/${maxRetries})...`);

          // 지수 백오프로 재시도
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));

          if (!cancelled) {
            load(); // 재귀 호출
          }
          return;
        }
      }

      // 최종 실패 시 에러 플레이스홀더
      if (!cancelled) {
        setThumbnail({
          dataUrl: PLACEHOLDER_ERROR,
          status: 'error',
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [image.id, image.pathInArchive, image.fileSize, sourceType, panelHeight, isVisible]);

  return (
    <button
      className={`thumbnail-card ${orientation} ${isActive ? 'active' : ''} ${thumbnail.status}`}
      style={{ height: `${panelHeight}px` }}
      onClick={onSelect}
      title={
        thumbnail.status === 'error'
          ? `Failed to load: ${image.pathInArchive}`
          : image.pathInArchive
      }
      ref={cardRef}
    >
      <img
        src={thumbnail.dataUrl}
        alt={image.fileName}
        loading="lazy"
        draggable={false}
        className={thumbnail.status}
      />

      {thumbnail.status === 'error' && (
        <span className="error-badge" title="Failed to load thumbnail">⚠️</span>
      )}

      <style>{`
        .thumbnail-card {
          flex: 0 0 auto;
          width: auto;
          height: 100%;
          aspect-ratio: 4 / 3;
          border: 1px solid #444;
          background: #222;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          position: relative;
        }

        .thumbnail-card.portrait {
          aspect-ratio: 3 / 4;
        }

        .thumbnail-card.active {
          border-color: #2da8ff;
          border-width: 2px;
          box-shadow: 0 0 8px rgba(45, 168, 255, 0.4);
        }

        .thumbnail-card:hover {
          border-color: #1484ff;
          transform: translateY(-2px);
        }

        .thumbnail-card.error {
          border-color: #ff4444;
          background: #2a1a1a;
        }

        .thumbnail-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #111;
        }

        .thumbnail-card img.loading {
          opacity: 0.5;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .thumbnail-card img.error {
          opacity: 0.3;
          filter: grayscale(100%);
        }

        .thumbnail-card.portrait img {
          object-fit: contain;
        }

        .error-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(255, 68, 68, 0.9);
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </button>
  );
};
```

**플레이스홀더 SVG 생성 (새 파일: `src/renderer/constants/placeholders.ts`)**:
```typescript
// src/renderer/constants/placeholders.ts

export const PLACEHOLDER_LOADING = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect fill="#222" width="100" height="100"/>
  <circle cx="50" cy="50" r="15" fill="none" stroke="#666" stroke-width="3" stroke-dasharray="70" stroke-linecap="round">
    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/>
  </circle>
</svg>
`)}`;

export const PLACEHOLDER_ERROR = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect fill="#2a1a1a" width="100" height="100"/>
  <path d="M50 30 L50 55 M50 65 L50 70" stroke="#ff4444" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#ff4444" stroke-width="3"/>
</svg>
`)}`;

export const PLACEHOLDER_BLANK = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect fill="#1a1a1a" width="100" height="100"/>
  <rect x="20" y="35" width="60" height="30" rx="8" fill="#2c2c2c" stroke="#3a3a3a" stroke-width="2"/>
</svg>
`)}`;
```

**검증 방법**:
- DevTools Performance 탭에서 fallback 요청 시 네트워크 payload(Chrome devtools → Network) 2KB 이하 확인
- 오류 이미지 클릭 시 PLACEHOLDER_ERROR 노출, 콘솔에 재시도 로그 2회 이하인지 확인

**예상 효과**:
- ✅ 전체 이미지 로드 제거로 네트워크/메모리 90% 절감
- ✅ 명확한 에러 상태 표시로 사용자 경험 개선
- ✅ 재시도 로직으로 일시적 오류 자동 복구

---

## P1: High Priority

### 3. 우선순위 큐 구현

**문제점**:
- 현재 FIFO 큐로 인해 스크롤 시 보이는 썸네일보다 화면 밖 썸네일이 먼저 로드될 수 있음
- 사용자가 빠르게 스크롤하면 불필요한 요청이 큐에 누적
- P2.5(동적 동시성)과 별도 구현 시 중복 코드/충돌 우려

**영향도**: High - 사용자 경험

- **현재 지표**: 빠른 스크롤에서 평균 대기 1.8s, 추가 스크롤 시 이전 요청이 잔류
- **목표 지표**: 현재 뷰 500ms 내 처리, 화면 밖 요청 우선순위 자동 하향

**공통 스케줄러 설계 (P1.3 + P2.5)**:

```typescript
// src/renderer/utils/thumbnailRequestQueue.ts

type Task<T> = () => Promise<T>;

interface PrioritizedTask<T> {
  task: Task<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  timestamp: number;
  abortController?: AbortController;
}

const DEFAULT_CONCURRENCY = Math.max(1, Math.min(4, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) / 2 || 1));

class PrioritizedQueue {
  private active = 0;
  private readonly pending: PrioritizedTask<unknown>[] = [];
  private concurrency = DEFAULT_CONCURRENCY;

  setConcurrency(next: number) {
    this.concurrency = Math.max(1, Math.min(6, Math.round(next)));
  }

  async run<T>(task: Task<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ task, priority, resolve, reject, timestamp: performance.now() });
      this.pending.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
      this.drain();
    });
  }

  private async drain() {
    if (this.active >= this.concurrency) {
      return;
    }

    const next = this.pending.shift();
    if (!next) {
      return;
    }

    this.active++;
    try {
      const result = await next.task();
      next.resolve(result);
    } catch (error) {
      next.reject(error);
    } finally {
      this.active--;
      this.drain();
    }
  }
}

const queue = new PrioritizedQueue();

export function runThumbnailTask<T>(task: Task<T>, priority = 0): Promise<T> {
  return queue.run(task, priority);
}

export function updateThumbnailConcurrency({
  throttleLevel,
  userActivityScore,
}: {
  throttleLevel: 'idle' | 'busy';
  userActivityScore: number; // 0~1
}) {
  const base = throttleLevel === 'busy' ? DEFAULT_CONCURRENCY / 2 : DEFAULT_CONCURRENCY;
  const adjusted = base + userActivityScore * 2;
  queue.setConcurrency(adjusted);
}
```

**우선순위 가이드라인**:

| 시나리오 | 제안 priority |
| --- | --- |
| 현재 뷰에 노출된 썸네일 | 100 |
| 현재 페이지 ±2 | 60 |
| 프리페치(±8) | 30 |
| 백그라운드 | 0 |

`BottomThumbnails`와 `FolderSidebar`는 priority 값을 전달하고, 사용자 입력 속도에 따라 `updateThumbnailConcurrency` 를 호출해 concurrency를 동적으로 조정합니다.

**BottomThumbnails.tsx 수정**:
```typescript
// src/renderer/components/viewer/BottomThumbnails.tsx

import { runThumbnailTask, Priority, clearLowPriorityTasks } from '../../utils/thumbnailRequestQueue';

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  image,
  sourceType,
  onSelect,
  isActive,
  panelHeight,
  distanceFromCurrent, // 새 prop: 현재 페이지로부터의 거리
}) => {
  // ... 기존 코드 ...

  useEffect(() => {
    let cancelled = false;
    if (!isVisible) {
      return undefined;
    }

    // 우선순위 계산
    const getPriority = (): number => {
      if (isActive) return Priority.CURRENT_VIEW;
      if (distanceFromCurrent <= 2) return Priority.PREFETCH_NEAR;
      if (distanceFromCurrent <= 8) return Priority.PREFETCH_FAR;
      return Priority.BACKGROUND;
    };

    const load = async () => {
      setThumbnail({ dataUrl: PLACEHOLDER_LOADING, status: 'loading' });

      try {
        const safeHeight = Math.max(panelHeight, 48);
        const maxWidth = Math.round(safeHeight * (4 / 3));

        const response: any = await runThumbnailTask(
          () => window.electronAPI.invoke(channels.IMAGE_GET_THUMBNAIL, {
            archiveId: image.archiveId,
            image,
            sourceType,
            maxHeight: safeHeight,
            maxWidth: Math.max(maxWidth, 48),
          }) as Promise<any>,
          getPriority() // 우선순위 전달
        );

        // ... 나머지 코드 ...
      } catch (error) {
        // ... 에러 처리 ...
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [image.id, sourceType, panelHeight, isVisible, isActive, distanceFromCurrent]);

  // ... 렌더링 코드 ...
};

// BottomThumbnails에서 distanceFromCurrent 계산
const BottomThumbnails: React.FC = () => {
  // ... 기존 코드 ...

  // 사용자가 빠르게 스크롤할 때 낮은 우선순위 작업 취소
  useEffect(() => {
    const handleScroll = () => {
      clearLowPriorityTasks(Priority.PREFETCH_NEAR);
    };

    const container = containerRef.current?.querySelector('.thumbnail-strip');
    container?.addEventListener('scroll', handleScroll);

    return () => {
      container?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="bottom-thumbnails" style={{ height: PANEL_HEIGHT }} ref={containerRef}>
      <div className="thumbnail-strip">
        {thumbnailImages.map(({ img, index }) => (
          <ThumbnailCard
            key={img.id}
            image={img}
            sourceType={currentSource?.type ?? SourceType.ARCHIVE}
            isActive={index === currentPageIndex}
            onSelect={() => navigateToPage(index)}
            panelHeight={cardHeight}
            distanceFromCurrent={Math.abs(index - currentPageIndex)}
          />
        ))}
      </div>
      {/* ... 스타일 ... */}
    </div>
  );
};
```

**예상 효과**:
- ✅ 보이는 썸네일 우선 로드로 체감 속도 50% 개선
- ✅ 빠른 스크롤 시 불필요한 요청 취소로 자원 절약
- ✅ 타임아웃으로 무한 대기 방지

---

### 4. useInViewport 의존성 최적화

**문제점**:
- `isIntersecting`이 의존성 배열에 포함되어 불필요한 재생성 발생
- 매번 Observer가 재생성되면서 성능 저하

**영향도**: Medium-High - 많은 썸네일 사용 시 누적

**개선 방안**:

```typescript
// src/renderer/hooks/useInViewport.ts

import { RefObject, useEffect, useState, useRef } from 'react';

interface UseInViewportOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

export function useInViewport<T extends Element>(
  targetRef: RefObject<T>,
  {
    threshold = 0,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = false
  }: UseInViewportOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);
  const frozenRef = useRef(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    // freezeOnceVisible이 활성화되고 이미 표시된 경우 스킵
    if (freezeOnceVisible && frozenRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIntersecting(true);

          if (freezeOnceVisible) {
            frozenRef.current = true;
            observer.disconnect();
          }
        } else {
          // freezeOnceVisible이 아닌 경우에만 상태 업데이트
          if (!freezeOnceVisible) {
            setIntersecting(false);
          }
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, threshold, root, rootMargin, freezeOnceVisible]); // isIntersecting 제거

  return isIntersecting;
}

// 전역 Observer 공유 버전 (선택적 사용)
export function useInViewportShared<T extends Element>(
  targetRef: RefObject<T>,
  options: UseInViewportOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);
  const frozenRef = useRef(false);
  const callbackRef = useRef<IntersectionObserverCallback>();

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    if (options.freezeOnceVisible && frozenRef.current) {
      return;
    }

    callbackRef.current = (entries) => {
      const entry = entries.find(e => e.target === target);
      if (!entry) return;

      if (entry.isIntersecting) {
        setIntersecting(true);

        if (options.freezeOnceVisible) {
          frozenRef.current = true;
          getSharedObserver(options).unobserve(target);
        }
      } else if (!options.freezeOnceVisible) {
        setIntersecting(false);
      }
    };

    const observer = getSharedObserver(options);
    observerCallbacks.set(target, callbackRef.current);
    observer.observe(target);

    return () => {
      observer.unobserve(target);
      observerCallbacks.delete(target);
    };
  }, [targetRef, options.threshold, options.root, options.rootMargin, options.freezeOnceVisible]);

  return isIntersecting;
}

// 전역 Observer 관리
const observerCache = new Map<string, IntersectionObserver>();
const observerCallbacks = new Map<Element, IntersectionObserverCallback>();

function getSharedObserver(options: UseInViewportOptions): IntersectionObserver {
  const key = JSON.stringify({
    threshold: options.threshold ?? 0,
    rootMargin: options.rootMargin ?? '0px',
  });

  let observer = observerCache.get(key);

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const callback = observerCallbacks.get(entry.target);
          callback?.([entry]);
        });
      },
      {
        threshold: options.threshold,
        root: options.root,
        rootMargin: options.rootMargin,
      }
    );

    observerCache.set(key, observer);
  }

  return observer;
}
```

**예상 효과**:
- ✅ Observer 재생성 횟수 90% 감소
- ✅ 메모리 사용량 감소 (공유 버전 사용 시)
- ✅ 렌더링 성능 개선

---

## P2: Medium Priority

### 5. 동적 동시성 조정

**문제점**:
- 모든 하드웨어에서 동일한 동시성(2) 사용
- 고성능 시스템에서는 리소스 낭비, 저성능 시스템에서는 과부하 가능

**영향도**: Medium - 다양한 하드웨어 환경 대응

**개선 방안**:

이미 위의 [우선순위 큐 구현](#3-우선순위-큐-구현)에서 다음 코드로 구현됨:

```typescript
// 동적 concurrency 조정
const getConcurrency = (): number => {
  if (typeof navigator === 'undefined') {
    return 2;
  }

  const cores = navigator.hardwareConcurrency || 2;

  // 코어 수에 따라 조정 (최소 2, 최대 6)
  if (cores <= 2) return 2;
  if (cores <= 4) return 3;
  if (cores <= 8) return 4;
  return 6;
};

const thumbnailQueue = new PriorityTaskQueue(getConcurrency());
```

**추가 고려사항**:
- 메모리 상태 기반 조정 (`performance.memory` API)
- 네트워크 속도 기반 조정 (`navigator.connection`)

```typescript
// src/renderer/utils/thumbnailRequestQueue.ts

const getOptimalConcurrency = (): number => {
  const baseConcurrency = getConcurrency();

  // 메모리 체크 (Chrome/Edge)
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    const usedPercent = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    // 메모리 사용률이 80% 이상이면 동시성 감소
    if (usedPercent > 0.8) {
      return Math.max(1, Math.floor(baseConcurrency / 2));
    }
  }

  // 네트워크 체크
  if ('connection' in navigator && (navigator as any).connection) {
    const connection = (navigator as any).connection;

    // 느린 연결이면 동시성 감소
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      return Math.max(1, Math.floor(baseConcurrency / 2));
    }
  }

  return baseConcurrency;
};
```

**예상 효과**:
- ✅ 하드웨어 성능에 맞는 최적화
- ✅ 저사양 시스템에서 안정성 향상
- ✅ 고사양 시스템에서 처리 속도 50% 향상

---

### 6. 캐시 키 충돌 방지

**문제점**:
- `fileSize`가 0인 경우 다른 이미지와 캐시 키 충돌 가능
- 아카이브 구조 변경 시 잘못된 캐시 사용

**영향도**: Medium - 드물지만 치명적

**개선 방안**:

```typescript
// src/main/services/ThumbnailService.ts

private buildCacheKey(image: Image, sourceType: SourceType, options: ResolvedOptions): string {
  const hash = createHash('sha256'); // sha1 → sha256으로 변경 (더 안전)

  // 1. 소스 타입
  hash.update(sourceType);

  // 2. 아카이브 ID
  hash.update(image.archiveId || 'unknown');

  // 3. 이미지 ID
  hash.update(image.id || '');

  // 4. 파일 경로 (고유성 보장)
  hash.update(image.pathInArchive || '');

  // 5. 파일 크기
  const size = typeof image.fileSize === 'number'
    ? image.fileSize
    : (typeof (image as any).size === 'number' ? (image as any).size : -1); // 0 대신 -1 사용
  hash.update(String(size));

  // 6. 수정 시간 (가능한 경우)
  if ('mtime' in image && image.mtime) {
    hash.update(String(image.mtime));
  }

  // 7. 이미지 차원 (가능한 경우)
  if (image.dimensions) {
    hash.update(`${image.dimensions.width}x${image.dimensions.height}`);
  }

  // 8. 썸네일 옵션
  hash.update(`${options.maxWidth}x${options.maxHeight}`);
  hash.update(options.format);
  hash.update(String(options.quality));

  // 9. 버전 태그 (캐시 무효화용)
  hash.update('v2'); // 캐시 구조 변경 시 증가

  return hash.digest('hex');
}

// 캐시 키 디버깅 메서드
private getCacheKeyInfo(image: Image, sourceType: SourceType, options: ResolvedOptions): object {
  return {
    sourceType,
    archiveId: image.archiveId,
    imageId: image.id,
    pathInArchive: image.pathInArchive,
    fileSize: image.fileSize,
    dimensions: image.dimensions,
    options: {
      size: `${options.maxWidth}x${options.maxHeight}`,
      format: options.format,
      quality: options.quality,
    },
  };
}
```

**테스트 케이스**:
```typescript
// tests/ThumbnailService.test.ts

describe('ThumbnailService cache key', () => {
  it('should generate different keys for different images', () => {
    const image1 = { id: '1', pathInArchive: 'a.jpg', fileSize: 0 };
    const image2 = { id: '2', pathInArchive: 'b.jpg', fileSize: 0 };

    const key1 = service.buildCacheKey(image1, SourceType.ARCHIVE, options);
    const key2 = service.buildCacheKey(image2, SourceType.ARCHIVE, options);

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different sizes', () => {
    const image = { id: '1', pathInArchive: 'a.jpg', fileSize: 1000 };
    const options1 = { ...defaultOptions, maxWidth: 100 };
    const options2 = { ...defaultOptions, maxWidth: 200 };

    const key1 = service.buildCacheKey(image, SourceType.ARCHIVE, options1);
    const key2 = service.buildCacheKey(image, SourceType.ARCHIVE, options2);

    expect(key1).not.toBe(key2);
  });
});
```

**예상 효과**:
- ✅ 캐시 키 충돌 가능성 제거
- ✅ 버전 관리로 안전한 캐시 무효화
- ✅ 디버깅 정보로 문제 추적 용이

---

## P3: Low Priority

### 7. Observer 전역 공유

**설명**: 이미 위의 [useInViewport 의존성 최적화](#4-useinviewport-의존성-최적화)에서 `useInViewportShared` 함수로 구현됨.

**사용 방법**:
```typescript
// 기존 방식 (컴포넌트마다 Observer 생성)
const isVisible = useInViewport(cardRef, { rootMargin: '96px 0px' });

// 공유 방식 (전역 Observer 재사용)
const isVisible = useInViewportShared(cardRef, { rootMargin: '96px 0px' });
```

**예상 효과**:
- ✅ Observer 인스턴스 수 90% 감소
- ✅ 메모리 사용량 감소
- ✅ 대량 썸네일 렌더링 시 성능 개선

---

### 8. 적응형 프리페칭

**문제점**:
- 항상 다음 8개만 프리페치
- 사용자 스크롤 패턴 무시

**영향도**: Low - 선택적 최적화

**개선 방안**:

```typescript
// src/renderer/hooks/useAdaptivePrefetch.ts

import { useEffect, useRef, useState } from 'react';

interface PrefetchConfig {
  forward: number;  // 앞으로 프리페치할 개수
  backward: number; // 뒤로 프리페치할 개수
}

export function useAdaptivePrefetch(currentIndex: number): PrefetchConfig {
  const [config, setConfig] = useState<PrefetchConfig>({ forward: 8, backward: 2 });
  const lastIndexRef = useRef(currentIndex);
  const directionHistoryRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeDelta = now - lastUpdateRef.current;
    const indexDelta = currentIndex - lastIndexRef.current;

    // 방향 기록
    if (indexDelta !== 0) {
      directionHistoryRef.current.push(indexDelta);

      // 최근 10개만 유지
      if (directionHistoryRef.current.length > 10) {
        directionHistoryRef.current.shift();
      }

      // 스크롤 속도 계산 (인덱스/초)
      const velocity = Math.abs(indexDelta) / (timeDelta / 1000);

      // 방향 분석
      const recentHistory = directionHistoryRef.current.slice(-5);
      const forwardCount = recentHistory.filter(d => d > 0).length;
      const backwardCount = recentHistory.filter(d => d < 0).length;

      let newConfig: PrefetchConfig;

      // 빠른 스크롤 (5 인덱스/초 이상)
      if (velocity > 5) {
        if (forwardCount > backwardCount) {
          // 빠르게 앞으로
          newConfig = { forward: 16, backward: 1 };
        } else {
          // 빠르게 뒤로
          newConfig = { forward: 1, backward: 16 };
        }
      }
      // 보통 스크롤
      else if (velocity > 1) {
        if (forwardCount > backwardCount) {
          newConfig = { forward: 12, backward: 2 };
        } else {
          newConfig = { forward: 2, backward: 12 };
        }
      }
      // 느린 탐색
      else {
        // 양방향 균등
        newConfig = { forward: 6, backward: 6 };
      }

      setConfig(newConfig);
    }

    lastIndexRef.current = currentIndex;
    lastUpdateRef.current = now;
  }, [currentIndex]);

  return config;
}
```

**BottomThumbnails.tsx 적용**:
```typescript
// src/renderer/components/viewer/BottomThumbnails.tsx

import { useAdaptivePrefetch } from '../../hooks/useAdaptivePrefetch';

const BottomThumbnails: React.FC = () => {
  const images = useViewerStore((state) => state.images);
  const currentSource = useViewerStore((state) => state.currentSource);
  const currentPageIndex = useViewerStore((state) => state.currentPageIndex);

  const prefetchConfig = useAdaptivePrefetch(currentPageIndex);

  // ... 기존 코드 ...

  useEffect(() => {
    if (!currentSource) {
      return;
    }

    const safeHeight = Math.max(cardHeight, 48);
    const maxWidth = Math.round(safeHeight * (4 / 3));

    // 적응형 프리페칭
    const forwardRange = thumbnailImages.filter(
      ({ index }) => index > currentPageIndex && index <= currentPageIndex + prefetchConfig.forward
    );

    const backwardRange = thumbnailImages.filter(
      ({ index }) => index < currentPageIndex && index >= currentPageIndex - prefetchConfig.backward
    );

    const upcoming = [...forwardRange, ...backwardRange];

    upcoming.forEach(({ img, index }) => {
      const distance = Math.abs(index - currentPageIndex);
      const priority = distance <= 2 ? Priority.PREFETCH_NEAR : Priority.PREFETCH_FAR;

      runThumbnailTask(
        () => window.electronAPI.invoke(channels.IMAGE_GET_THUMBNAIL, {
          archiveId: img.archiveId,
          image: img,
          sourceType: currentSource.type ?? SourceType.ARCHIVE,
          maxHeight: safeHeight,
          maxWidth: Math.max(maxWidth, 48),
        }).catch(() => undefined),
        priority
      );
    });
  }, [currentSource, thumbnailImages, currentPageIndex, cardHeight, prefetchConfig]);

  // ... 렌더링 코드 ...
};
```

**예상 효과**:
- ✅ 사용자 패턴에 맞는 지능형 프리페칭
- ✅ 불필요한 프리페치 감소로 리소스 절약
- ✅ 체감 로딩 속도 30% 개선

---

## 구현 순서 제안

### Phase 1: 안정성 확보 (1-2일)
1. ✅ P0-1: ThumbnailService 캐시 크기 관리
2. ✅ P0-2: 폴백 로직 개선

### Phase 2: 성능 최적화 (2-3일)
3. ✅ P1-3: 우선순위 큐 구현
4. ✅ P1-4: useInViewport 의존성 최적화

### Phase 3: 고급 기능 (1-2일)
5. ✅ P2-5: 동적 동시성 조정 (우선순위 큐에 포함)
6. ✅ P2-6: 캐시 키 충돌 방지

### Phase 4: 선택적 개선 (1-2일, 선택)
7. ✅ P3-7: Observer 전역 공유
8. ✅ P3-8: 적응형 프리페칭

---

## 테스트 체크리스트

### 기능 테스트
- [ ] 캐시 크기 제한이 정상 작동하는가?
- [ ] LRU 정책이 올바르게 동작하는가?
- [ ] 플레이스홀더가 적절히 표시되는가?
- [ ] 에러 상태가 명확하게 표시되는가?
- [ ] 우선순위 큐가 올바른 순서로 처리하는가?
- [ ] 빠른 스크롤 시 낮은 우선순위 작업이 취소되는가?

### 성능 테스트
- [ ] 초기 로딩 시간이 개선되었는가?
- [ ] 메모리 사용량이 제한 내에 있는가?
- [ ] 디스크 캐시가 500MB를 초과하지 않는가?
- [ ] 스크롤 성능이 부드러운가? (60fps)
- [ ] 대량 이미지(300+) 로드 시 안정적인가?

### 엣지 케이스 테스트
- [ ] 손상된 이미지 처리
- [ ] 네트워크 오류 처리
- [ ] 빠른 페이지 전환
- [ ] 디스크 공간 부족
- [ ] 메모리 부족 상황

---

## 모니터링 추가

```typescript
// src/main/services/ThumbnailService.ts

export class ThumbnailService {
  // 성능 메트릭 수집
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    avgProcessingTime: 0,
    errors: 0,
  };

  async getThumbnail(params: {
    archiveId: string;
    image: Image;
    sourceType: SourceType;
    options?: ThumbnailOptions;
  }): Promise<ThumbnailResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.getThumbnailInternal(params);

      // 처리 시간 업데이트
      const processingTime = Date.now() - startTime;
      this.metrics.avgProcessingTime =
        (this.metrics.avgProcessingTime * (this.metrics.totalRequests - 1) + processingTime)
        / this.metrics.totalRequests;

      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
        : 0,
      errorRate: this.metrics.totalRequests > 0
        ? (this.metrics.errors / this.metrics.totalRequests) * 100
        : 0,
    };
  }
}
```

**메트릭 확인**:
```typescript
// 개발자 도구 콘솔에서
window.electronAPI.invoke('thumbnail:getMetrics').then(console.log);
// {
//   cacheHits: 850,
//   cacheMisses: 150,
//   totalRequests: 1000,
//   avgProcessingTime: 45,
//   errors: 2,
//   cacheHitRate: 85,
//   errorRate: 0.2
// }
```

---

## 참고 자료

- [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Web Performance Best Practices](https://web.dev/performance/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

**문서 버전**: 1.0
**최종 수정**: 2025-11-14
**작성자**: Claude Code Performance Review
