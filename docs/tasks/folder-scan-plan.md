# P6 – 폴더 초기 로딩 지연 개선 실행 계획

## 작업 개요
폴더/압축파일을 열 때 첫 이미지를 즉시 보여주고, 나머지 하위 폴더 탐색은 백그라운드에서 진행하도록 구조를 재설계합니다. 아래 단계는 IPC 스펙, 메인/렌더러 로직, UI 개선까지 포함한 전체 실행 계획입니다.

## 작업 목록

### 1. IPC 계약 및 데이터 구조 분리
- [ ] `folder:open` 응답 구조를 `initialImages` + `initialFolderNode` + `scanToken` 등 최소 정보로 단순화
- [ ] 백그라운드 탐색 진행 상황을 전달할 `folder:scan-progress` / `folder:scan-complete` 이벤트 스펙 정의
- [ ] 스캔 취소용 `folder:scan-cancel` IPC 추가 (새 폴더 열기나 사용자 취소 시 사용)

### 2. 메인 프로세스 백그라운드 스캐너
- [ ] `FolderService` 스캔 로직을 워커/비동기 큐로 분리하여 chunk 단위로 탐색
- [ ] 각 chunk마다 `scan-progress` 이벤트를 발행하고, 토큰으로 요청/응답 매칭
- [ ] 취소 요청 시 워커/큐 작업을 안전하게 중단하고 상태 정리

### 3. 렌더러 스토어/상태 확장
- [ ] `viewerStore`에 `folderScanStatus`, `scanProgress`, `folderTreeChunks` 등의 상태 추가
- [ ] 소스 전환/앱 초기화 시 스캔 상태 및 로컬 캐시 초기화
- [ ] 진행 상황을 표시하기 위한 selector/헬퍼 작성

### 4. FolderSidebar UI 업데이트
- [ ] Sidebar에 “스캔 중” 배지/프로그레스 UI 추가, 진행률/취소 버튼 제공
- [ ] `folderTreeChunks`가 도착할 때마다 리스트를 점진적으로 append
- [ ] 스캔 완료 시 배지 제거, 폴더 리스트 전체 사용 가능

### 5. 초기 이미지 우선 로딩
- [ ] `openFolder()`/`openArchive()`가 `initialImages`만 받아도 즉시 `setImages` 및 첫 이미지 렌더가 가능하도록 로직 분리
- [ ] 백그라운드 스캔 완료 후 전체 이미지/폴더 정보를 병합하는 동기화 로직 추가

### 6. 테스트 및 UX 검증
- [ ] 대용량 폴더(깊은 계층 구조)로 초기 로딩 시간 개선 여부 측정
- [ ] 스캔 중 폴더 전환, 취소, 앱 종료 등 edge case 테스트
- [ ] 오류 발생 시 UI 피드백 및 fallback 전략 검증

## 메트릭/성공 기준
- 폴더 열기 후 첫 이미지 표시까지의 평균 시간이 기존 대비 최소 50% 이상 단축
- 스캔 취소/재시작 시 UI 일관성 유지 (이상 동작 없음)
- CPU/메모리 사용률이 기존 대비 증가하지 않으며, 백그라운드 스캔이 UX에 지장을 주지 않음
