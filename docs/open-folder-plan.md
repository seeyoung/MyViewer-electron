# Open Folder Support Plan

위 기능은 기존 압축 아카이브 흐름을 재사용하면서, 일반 폴더를 이미지 소스로 취급할 수 있도록 확장하는 작업이다. 아래 단계들을 순서대로 진행하면 된다.

## 1. 소스/세션 모델 정비
- [x] `SourceDescriptor` 타입 정의: `id`, `type ('archive'|'folder')`, `path`, `label`.
- [x] Zustand 스토어(`viewerStore`)에서 `currentArchive`를 `currentSource`로 바꾸고, 공통 필드(이미지 목록 등)를 그대로 유지.
- [x] `ViewingSession` 타입/DB 스키마에 `sourceType`/`sourcePath` 추가. 기존 데이터를 마이그레이션하거나 기본값(`archive`)을 둔다.
- [x] `SessionService` 및 저장/읽기 로직이 새 필드를 사용하도록 업데이트.

## 2. FolderService + IPC 채널
- [ ] `src/main/services/FolderService.ts` 생성: 주어진 폴더 경로에서 이미지 파일을 재귀적으로 스캔해 `Image[]`와 `FolderNode` 트리를 만든다.
  - 비동기 `fs.promises` 사용, 숨김/비이미지 파일 필터링.
  - 대용량 폴더 대비: 필요하면 워커나 스트리밍 스캔 고려.
- [ ] IPC 채널 추가
  - `folder:open`: FolderService가 반환한 `{ source, images, session }` 구조를 JSON-safe 객체로 만들어 렌더러로 응답.
  - (선택) `folder:close`: 리소스 캐시 해제.
- [ ] `SessionService.getOrCreateSession` 시그니처에 `sourceType`/`sourcePath` 적용.

## 3. 메뉴/UX 업데이트
- [x] Electron 메뉴에 "Open Folder…" 항목 추가 (`Cmd+Shift+O`).
- [x] 선택된 경로를 메인 프로세스에서 렌더러로 전달해 `folder:open` 흐름을 호출.
- [x] 렌더러 UI에서 현재 소스 정보를 `currentSource` 기반으로 표시하고, 폴더인지 아카이브인지 뱃지로 구분.
- [ ] 대용량 폴더 로딩 중에는 기존 `LoadingIndicator` 혹은 "Scanning folder..." 메시지를 보여준다.

## 4. 렌더러 훅/상태 통합
- [ ] `useArchive` 훅을 `useSource`로 일반화. `openSource({ type, path })`가 내부적으로 `archive:open` 또는 `folder:open`을 호출.
- [ ] 반환값을 `{ source, session, images }` 공통 포맷으로 처리하고, Zustand 스토어를 통해 뷰 상태를 업데이트.
- [ ] 내비게이션 바/뷰어에서 `currentSource` 기반으로 이름, 타입, 경로를 표시하도록 수정.

## 5. 테스트 & 검증
- [ ] 폴더 선택 → 이미지 표시까지 수동 테스트 (서브 폴더 포함/미포함, 비이미지 파일 포함 등).
- [ ] 기존 아카이브 기능 회귀 테스트.
- [ ] 필요 시 문서(`docs/open-folder-plan.md`)에 진행 상황을 체크하거나 후속 이슈로 쪼갠다.
