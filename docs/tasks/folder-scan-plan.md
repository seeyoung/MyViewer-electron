# P6 – 폴더 초기 로딩 지연 개선 실행 계획

## 작업 개요
폴더/압축파일을 열 때 첫 이미지를 즉시 보여주고, 나머지 하위 폴더 탐색은 백그라운드에서 진행하도록 구조를 재설계합니다. 아래 단계는 IPC 스펙, 메인/렌더러 로직, UI 개선까지 포함한 전체 실행 계획입니다.

## 구현 단계 (Phase)

### Phase 1 (MVP) - 폴더만 지원, 단순 비동기 처리
- 폴더(FolderService)만 대상으로 초기 구현
- 단순 Promise 기반 비동기 청크 처리
- 기본적인 진행률 UI
  - 영향 모듈: `FolderService`, `folder:open` IPC, `useArchive`, `FolderSidebar`, `BottomThumbnails`

### Phase 2 - 아카이브 추가, 캐싱 도입
- ArchiveService도 동일한 지연 로딩 전략 적용
- 폴더 스캔 결과 캐싱 (mtime 기반)
- 고급 에러 처리
  - 영향 모듈: `ArchiveService`, `archive:open` IPC, 캐시 저장소(JSON/SQLite)
- 캐시 설계 추가 사항:
  - [ ] 캐시 키: `(sourcePath, mtime)` 조합으로 식별
  - [ ] 저장 위치: 사용자 데이터 디렉터리 내 JSON 혹은 SQLite 테이블(`scan_cache`)
  - [ ] 만료 정책: mtime 변경 시 무효화, 용량 초과 시 LRU 방식으로 정리

### Phase 3 - 고급 최적화
- Worker Threads 활용
- 스마트 우선순위 처리 (현재 보는 폴더 우선)
- 메모리 사용량 제한 및 최적화

## 작업 목록

### 1. 타입 정의 및 데이터 구조 설계
- [ ] `FolderOpenInitialResponse` 타입 정의 (initialImages, rootFolder, scanToken)
- [ ] `ScanProgressEvent` 타입 정의 (token, discovered, processed, currentPath, chunks)
- [ ] `ScanCompleteEvent` 타입 정의
- [ ] `ScanStatus` enum 정의 (IDLE, SCANNING, PAUSED, COMPLETED, FAILED, CANCELLED)
- [ ] scanToken 생성/검증 로직 설계 (UUID 기반)
- [ ] 부분 FolderNode 병합 알고리즘 설계

**타입 예시:**
```typescript
interface FolderOpenInitialResponse {
  source: SourceDescriptor;
  initialImages: Image[];        // 첫 N개 또는 루트 폴더만
  rootFolder: FolderNode;        // 부분 트리
  scanToken: string;
  estimatedTotal?: number;
  isComplete: boolean;           // 즉시 완료된 경우
}

interface ScanProgressEvent {
  token: string;
  discovered: number;            // 발견된 총 파일 수
  processed: number;             // 처리 완료된 파일 수
  currentPath: string;           // 현재 스캔 중인 경로
  folderChunk?: FolderNode[];    // 새로 발견된 폴더 청크
  imageChunk?: Image[];          // 새로 발견된 이미지 청크
}

interface ScanCompleteEvent {
  token: string;
  totalImages: number;
  totalFolders: number;
  duration: number;              // 스캔 소요 시간(ms)
}
```

### 2. IPC 계약 및 채널 정의
- [ ] `folder:open` 응답 구조를 `FolderOpenInitialResponse`로 변경
- [ ] `folder:scan-progress` 이벤트 채널 추가 (main → renderer)
- [ ] `folder:scan-complete` 이벤트 채널 추가 (main → renderer)
- [ ] `folder:scan-cancel` IPC 추가 (새 폴더 열기나 사용자 취소 시 사용)
- [ ] `archive:open` 응답 구조도 동일하게 변경 (Phase 2)
- [ ] `archive:scan-progress` / `archive:scan-complete` 추가 (Phase 2)
- [ ] IPC 채널 상수를 `src/shared/constants/ipc-channels.ts`에 추가

### 3. 메인 프로세스 백그라운드 스캐너 (FolderService)
- [ ] `FolderService.openFolder()` 메서드를 두 단계로 분리:
  - 즉시 응답: 루트 폴더의 첫 100개 이미지만 반환
  - 백그라운드: 나머지 하위 폴더 스캔
- [ ] 스캔 전략 설정:
  - **Chunk 크기**: 100개 파일 단위로 처리
  - **우선순위**: 너비 우선 탐색 (BFS) - 얕은 폴더부터 보여주기
  - **스로틀링**: 청크 간 10ms 대기로 메인 프로세스 과부하 방지
- [ ] 각 chunk마다 `folder:scan-progress` 이벤트 발행
- [ ] scanToken으로 요청/응답 매칭 (동시에 여러 폴더 열기 대응)
- [ ] 취소 요청 시 스캔 루프 안전하게 중단 및 상태 정리
- [ ] 스캔 중 에러 발생 시 부분 결과 유지 (graceful degradation)

**스캔 전략 예시:**
```typescript
// src/main/services/FolderService.ts
async openFolderWithProgressiveScan(folderPath: string): Promise<FolderOpenInitialResponse> {
  const scanToken = randomUUID();

  // 1단계: 루트 레벨만 즉시 스캔
  const initialImages = await this.scanSingleLevel(folderPath, 100);
  const rootFolder = this.buildPartialTree(initialImages);

  // 2단계: 백그라운드 스캔 시작
  this.startBackgroundScan(folderPath, scanToken, initialImages.length);

  return {
    source: { id: randomUUID(), type: SourceType.FOLDER, path: folderPath },
    initialImages,
    rootFolder,
    scanToken,
    isComplete: false
  };
}

private async startBackgroundScan(folderPath: string, token: string, offset: number) {
  // BFS로 하위 폴더 탐색, 100개 단위로 이벤트 발행
  // 취소 플래그 확인, 에러 처리 포함
}
```

### 4. 렌더러 스토어/상태 확장 (viewerStore.ts)
- [ ] Zustand 스토어에 스캔 관련 상태 추가:
  ```typescript
  interface ViewerState {
    // 기존 상태...

    // 스캔 관련 상태 추가
    scanStatus: 'idle' | 'scanning' | 'completed' | 'failed' | 'cancelled';
    scanToken: string | null;
    scanProgress: {
      discovered: number;
      processed: number;
      currentPath: string;
      percentage: number;
    } | null;

    // 액션 추가
    setScanStatus: (status: ScanStatus) => void;
    updateScanProgress: (progress: ScanProgressEvent) => void;
    cancelScan: () => void;
  }
  ```
- [ ] 이미지/폴더 청크를 점진적으로 병합하는 로직 추가
- [ ] 소스 전환 시 이전 스캔 취소 및 상태 초기화
- [ ] `reset()` 액션에 스캔 상태 초기화 포함

### 5. FolderSidebar UI 업데이트 (src/renderer/components/viewer/FolderSidebar.tsx)
- [ ] 컴포넌트에 스캔 상태 표시 UI 추가:
  - **진행률 바**: "이미지 검색 중... 1,234 / ~5,000 (24%)"
  - **현재 경로**: "chapter3/subfolder 스캔 중..."
  - **취소 버튼**: 사용자가 스캔을 중단할 수 있도록
- [ ] Zustand에서 `scanStatus`, `scanProgress` 구독
- [ ] 폴더 트리가 점진적으로 확장되는 애니메이션 추가 (선택사항)
- [ ] 스캔 완료 시 배지/프로그레스 UI 제거
- [ ] 스캔 중 사용자가 아직 스캔 안 된 폴더 클릭 시 안내 메시지 표시

**UI 예시:**
```tsx
{scanStatus === 'scanning' && (
  <div className="scan-progress">
    <ProgressBar value={scanProgress?.percentage || 0} />
    <div className="scan-info">
      <span>{scanProgress?.processed} / ~{scanProgress?.discovered} 이미지</span>
      <button onClick={handleCancelScan}>취소</button>
    </div>
    <div className="scan-path">{scanProgress?.currentPath}</div>
  </div>
)}
```

### 6. 초기 이미지 우선 로딩 통합
- [ ] `useArchive` hook 수정: `FolderOpenInitialResponse` 처리 로직 추가
- [ ] `initialImages`만 받아도 즉시 `setImages()` 및 첫 이미지 렌더링 가능하도록 분리
- [ ] IPC 이벤트 리스너 등록: `folder:scan-progress`, `folder:scan-complete`
- [ ] 백그라운드 스캔 중 새 이미지/폴더 청크 도착 시 스토어에 병합
- [ ] 스캔 완료 후 전체 이미지 목록 재정렬 및 인덱스 업데이트
- [ ] SessionService와 통합: 스캔 중 세션 저장 시 `isComplete` 플래그 고려

### 7. 보안 및 안정성
- [ ] **최대 스캔 깊이 제한**: 20 레벨 초과 시 경고 및 중단
- [ ] **최대 파일 개수 제한**: 100,000개 초과 시 사용자 확인 요청
- [ ] **심볼릭 링크 순환 참조 감지**: 이미 방문한 경로 추적
- [ ] **권한 에러 graceful 처리**: EACCES 발생 시 해당 폴더 스킵하고 계속 진행
- [ ] **경로 검증 강화**: 기존 `sanitizePath()` 외 추가 검증
- [ ] **DoS 방지**: 악의적인 깊은 디렉토리 구조 대응 (예: 1000 레벨 중첩)

**보안 설정 예시:**
```typescript
const SCAN_LIMITS = {
  MAX_DEPTH: 20,
  MAX_FILES: 100_000,
  MAX_PATH_LENGTH: 4096,
  CHUNK_DELAY_MS: 10,
};
```

### 8. 에러 처리 및 복구 전략
- [ ] 스캔 중 파일 시스템 에러 처리:
  - **EACCES** (권한 없음): 폴더 스킵, 부분 결과 반환
  - **ENOENT** (파일 없음): 폴더 스킵
  - **EMFILE** (파일 핸들 부족): 청크 크기 축소 후 재시도
- [ ] 네트워크 드라이브 타임아웃 처리
- [ ] 부분 실패 시 이미 스캔한 데이터 활용 (graceful degradation)
- [ ] 스캔 타임아웃 정책: 5분 초과 시 자동 중단 및 부분 결과 사용
- [ ] 에러 발생 시 UI에 명확한 피드백 제공

### 9. 성능 최적화
- [ ] **스캔 결과 캐싱**:
  - 폴더 경로 + mtime을 키로 localStorage 또는 SQLite에 캐시
  - 재방문 시 변경사항 없으면 캐시 사용
- [ ] **썸네일 생성 조율**:
  - ThumbnailService와 스캔 작업의 CPU 경쟁 방지
  - 가시 영역 이미지 썸네일 우선 생성
- [ ] **메모리 관리**:
  - 대용량 폴더 (10만+ 파일) 시 메모리 사용량 모니터링
  - 필요 시 가상 스크롤링 및 청크 언로드
- [ ] **자연 정렬 최적화**:
  - 청크 단위로 정렬 후 병합, 전체 재정렬 최소화

### 10. 아카이브 지원 확장 (Phase 2)
- [ ] `ArchiveService.openArchive()` 메서드도 동일한 점진적 로딩 적용
- [ ] ZIP/RAR 엔트리 스트리밍 조사:
  - `yauzl` (ZIP): 스트리밍 지원 확인
  - `node-unrar-js` (RAR): 청크 단위 읽기 가능 여부 확인
- [ ] 압축 파일 크기 기반 예상 시간 표시
- [ ] ArchiveService에도 동일한 취소/에러 처리 로직 적용

### 11. 세션 복원 통합
- [ ] SessionService 스키마 확장: `scanStatus`, `lastScannedPath` 컬럼 추가
- [ ] 스캔 중 앱 종료 시:
  - 부분 스캔 결과를 세션에 저장 (선택사항, 복잡도 고려)
  - 또는 다음 실행 시 전체 재스캔 (단순 구현)
- [ ] 세션 복원 시 스캔 완료 여부 확인
- [ ] 미완료 스캔 세션 복원 시 백그라운드 스캔 재개 (Phase 3)

### 12. 마이그레이션 및 호환성
- [ ] 기존 `FOLDER_OPEN` IPC 채널 하위 호환성 유지:
  - 기능 플래그 또는 별도 채널 (`folder:open-progressive`) 사용
  - 점진적 롤아웃 후 기존 방식 제거
- [ ] 렌더러 코드에서 신규/기존 응답 형식 모두 처리
- [ ] 롤백 시나리오: 기능 플래그로 기존 동작 복구 가능하도록
- [ ] 데이터베이스 마이그레이션 (세션 스키마 변경 시)

### 13. 테스트 및 검증

#### 기능 테스트
- [ ] **소형 폴더 (< 100개)**: 즉시 완료, 스캔 UI 표시 안 됨
- [ ] **중형 폴더 (100-1,000개)**: 초기 이미지 즉시 표시, 스캔 진행률 표시
- [ ] **대형 폴더 (1,000-10,000개)**: 초기 응답 < 500ms, 백그라운드 완료까지 추적
- [ ] **초대형 폴더 (10,000개+)**: 초기 응답 < 1s, 메모리 안정성 확인

#### Edge Case 테스트
- [ ] 스캔 중 새 폴더 열기 → 이전 스캔 자동 취소
- [ ] 스캔 중 앱 종료 → 다음 실행 시 정상 동작
- [ ] 권한 없는 폴더 포함 → 부분 결과 반환, 에러 메시지
- [ ] 심볼릭 링크 순환 참조 → 감지 및 중단
- [ ] 네트워크 드라이브 (느린 I/O) → 타임아웃 처리
- [ ] 깊은 중첩 구조 (20+ 레벨) → 제한 적용

#### 성능 테스트
- [ ] **초기 로딩 시간 측정** (첫 이미지 표시까지):
  - 1,000개 파일 (단일 폴더): < 200ms (목표)
  - 10,000개 파일 (10계층): < 500ms (목표)
  - 100,000개 파일 (깊은 구조): < 1s (목표)
- [ ] **백그라운드 스캔 성능**:
  - CPU 사용률 < 30% (단일 코어)
  - 메모리 증가량 < 500MB (100,000개 파일 기준)
  - UI 응답성 유지 (60fps)
- [ ] **캐싱 효과 측정**:
  - 동일 폴더 재방문 시 < 50ms
  - 캐시 적중률 > 90% (재방문 시)

#### UX 검증
- [ ] 진행률 표시가 자연스럽고 정확한가?
- [ ] 스캔 중 폴더 트리 확장이 혼란스럽지 않은가?
- [ ] 취소 버튼이 즉시 반응하는가?
- [ ] 에러 메시지가 명확하고 도움이 되는가?
- [ ] 스캔 완료 후 UI 전환이 부드러운가?

#### 호환성 테스트
- [ ] Windows 10/11
- [ ] macOS (Intel, Apple Silicon)
- [ ] Linux (Ubuntu, Fedora)
- [ ] NTFS, APFS, ext4 파일 시스템
- [ ] 네트워크 드라이브 (SMB, NFS)

## 메트릭 및 성공 기준

### 정량적 지표
| 메트릭 | 현재 (추정) | 목표 | 측정 방법 |
|--------|------------|------|----------|
| 초기 로딩 시간 (1,000개) | 1-2s | < 200ms | `performance.now()` |
| 초기 로딩 시간 (10,000개) | 10-20s | < 500ms | `performance.now()` |
| 초기 로딩 시간 (100,000개) | 2-5분 | < 1s | `performance.now()` |
| 백그라운드 완료 시간 (10,000개) | N/A | < 5s | IPC 이벤트 타임스탬프 |
| 메모리 사용량 (100,000개) | ~200MB | < 500MB | `process.memoryUsage()` |
| CPU 사용률 (스캔 중) | ~50% | < 30% | Task Manager/Activity Monitor |

### 정성적 지표
- ✅ 폴더 열기 후 첫 이미지 표시까지 체감 지연 없음
- ✅ 스캔 중 UI가 멈추거나 버벅이지 않음
- ✅ 스캔 취소/재시작 시 UI 일관성 유지
- ✅ 에러 발생 시 부분 결과 활용 가능
- ✅ 백그라운드 스캔이 다른 작업(썸네일 생성, 이미지 로딩)에 영향 없음

### 최소 성공 기준 (Phase 1)
1. 1,000개 이상 파일 폴더에서 초기 로딩 시간 **50% 이상 단축**
2. 백그라운드 스캔 중 **UI 응답성 유지** (프레임 드롭 < 10%)
3. 스캔 취소 기능 정상 동작
4. 권한 에러 등 예외 상황에서 **부분 결과 반환**
5. 기존 기능(세션 복원, 북마크 등) **호환성 유지**

## 참고 자료

### 관련 파일
- `src/main/services/FolderService.ts` - 폴더 스캔 로직
- `src/main/services/ArchiveService.ts` - 아카이브 스캔 로직
- `src/renderer/store/viewerStore.ts` - Zustand 상태 관리
- `src/renderer/components/viewer/FolderSidebar.tsx` - 폴더 트리 UI
- `src/shared/constants/ipc-channels.ts` - IPC 채널 정의
- `src/main/ipc/handlers.ts` - IPC 핸들러 등록

### 기술 문서
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html) - 멀티스레딩 (Phase 3)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc) - 프로세스 간 통신
- [Zustand](https://docs.pmnd.rs/zustand) - 상태 관리
- [fs.promises](https://nodejs.org/api/fs.html#promises-api) - 비동기 파일 시스템

### 성능 프로파일링 도구
- Chrome DevTools (Renderer 프로세스)
- Electron Performance Monitor
- `console.time()` / `console.timeEnd()`
- `process.memoryUsage()` / `process.cpuUsage()`

---

**마지막 업데이트:** 2025-11-14
**작성자:** Claude (AI Assistant)
**버전:** 2.0 (상세 명세 추가)
- [ ] 영향받는 렌더러 모듈 리스트 업데이트 (`useArchive`, `FolderSidebar`, `BottomThumbnails`, `viewerStore` 등)
