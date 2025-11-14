# Playlist (Folder/Archive Queue) 실행 계획

## 목표
- 폴더/압축파일 단위의 플레이리스트를 생성하고, 사용자가 정의한 순서로 소스를 감상할 수 있게 한다.
- Finder(외부 파일 탐색기)에서 드래그 앤 드롭, 앱 내부 Sidebar/Recent 목록에서 드래그 앤 드롭을 지원해 편리한 리스트 편집 경험 제공.
- 재생 중에는 현재 리스트 정보를 바탕으로 다음 폴더/압축파일로 자동 이동할 수 있도록 네비게이션과 연계.

## 작업 항목

### 1. 데이터 모델/저장소
- [ ] Playlist 스키마 정의 (`id`, `name`, `description`, `entries[]` 등)
- [ ] `entries[]`는 `{ sourcePath, sourceType, label }`만 담아 폴더/아카이브를 식별
- [ ] 로컬 DB 또는 JSON 파일에 저장/불러오기 로직 구현

### 2. IPC & 드래그 앤 드롭 입력 처리
- [ ] Finder 등 외부 앱에서 드래그한 파일을 받기 위해 `document` 단위의 `dragover/drop` 핸들러를 등록하고, `File.path`를 활용해 폴더/압축파일 경로 수집
- [ ] `window.electronAPI.send('playlist:add-from-drop', payload)` 형태로 메인 프로세스에 전달하여, 해당 경로를 Playlist 엔티티로 변환/추가
- [ ] 앱 내부 리스트(Recent, FolderSidebar 등)에서 Playlist 패널로 끌어다 놓을 때도 동일한 IPC 경로 탑재

### 3. 메인 프로세스 처리
- [ ] 새 IPC 채널 `playlist:add-from-drop` / `playlist:add-entry` / `playlist:remove-entry` / `playlist:save` / `playlist:load` 정의
- [ ] 드래그에서 받은 경로가 폴더인지 압축파일인지 판별하고, label/sourceType 등을 채워 Playlist 엔티티로 저장
- [ ] Playlist CRUD에 대한 persistence를 담당 (sqlite/json 등)

### 4. Playlist UI (NavigationBar + Panel)
- [ ] NavigationBar에 Playlist 버튼 추가 → 클릭 시 우측 도킹 패널 또는 모달 열림
- [ ] 패널 기본 상태: 현재 열려 있는 폴더/아카이브를 첫 entry로 표시
- [ ] 드래그 대상이 들어오면 drop 영역에서 순서 삽입을 시각적으로 표시
- [ ] 항목 선택 후 Delete 키로 삭제, 드래그로 순서 변경 지원 (예: react-beautiful-dnd 등 사용 고려)
- [ ] 재생 컨트롤(Play/Stop/Next/Prev)과 “자동 다음 소스로 이동” 토글 제공

### 5. 네비게이션 연동
- [ ] 활성 플레이리스트가 있을 때 `goToNext()`가 소스 마지막 → 다음 entry 로직을 수행하도록 `useImageNavigation` 확장
- [ ] 세션/폴더별 마지막 위치 기억 기능과 연계하여, 플레이리스트 entry를 열 때 자동으로 마지막 위치로 이동
- [ ] 자동 슬라이드와도 호환되도록(오토 슬라이드 종료 시 다음 entry로 넘어가기) option 추가

### 6. UX/에지 케이스
- [ ] Playlist entry가 더 이상 존재하지 않는 경로일 때 사용자에게 안내 및 제거 옵션 제공
- [ ] 폴더/압축파일 마운트 해제 등으로 열리지 않을 경우 graceful fallback
- [ ] Playlist 패널이 열린 상태에서 앱 닫힐 때, 마지막 상태 자동 저장

## 검증 포인트
- Finder에서 끌어온 폴더/압축파일이 즉시 리스트에 추가되고, 클릭 시 해당 소스로 이동하는지 확인
- 재생 리스트 순서대로 `Next`/오토 슬라이드가 작동하는지, 경계 조건(리스트 끝)에서 적절히 멈추는지 확인
- 리스트를 여러 개 저장/불러오기 할 수 있도록 확장할 수 있는 구조인지 점검
