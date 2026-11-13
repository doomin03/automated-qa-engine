# Proposal

## Why

현재 기본 template는 로그인 예제 한 개이고, XML 파일 블록의 의미 변환은 Checker Dart에 있다. 외부 프로젝트와 다중 AI CLI 작성 환경도 같은 정본을 사용하도록 기본 기술 템플릿·순수 조합·sourceMap·진단을 독립 Engine 공개 API/CLI로 제공한다.

## What Changes

- 버전/hash/입력 schema/지원 플랫폼/capability를 가진 기본 기술 템플릿 4종을 제공한다. 입력이 완성되어야 기존 Blueprint를 생성·검증하며 자동 실행하지 않는다.
- 기존 Checker의 단일 target·순차 outer/internal DAG 조합을 순수 Engine 작성 모듈로 이관한다. 기존 namespace·참조 치환·branch 종료 label·snapshot 의미 동등성을 검증한다.
- 공개 `listTemplates`, `createTemplate`, `composeBlueprint` 및 additive CLI `templates list|show|create`, `compose FILE`을 제공한다. 기존 `template`, `preset`, `expand` 의미는 유지한다.
- execution schema와 별도의 authoring contract 0.1.0-draft.1을 JSON Schema/타입/예제로 공개한다. runtime alpha.9의 로컬 아카이브/hash를 독립 consumer에서 인수한 뒤 Checker가 소비한다.
- Checker는 라이브러리·프로젝트·좌표·undo·다중 PTY/AI provider·명시 실행을 계속 소유한다. 구 Engine에 새 명령이 없으면 미지원으로 표시하며 묵시 구 합성기 fallback/저장 포맷 변환을 하지 않는다.

## Capabilities

### New Capabilities

- `qa-document-templates`: 버전 고정된 기술 템플릿 목록과 완전한 bindings로 검증된 문서를 생성한다.
- `qa-blueprint-composition`: 출처가 고정된 블록 원문과 인스턴스·연결을 결정적 Blueprint/XML/sourceMap/진단으로 변환한다.

### Modified Capabilities

없음. openspec/specs의 동기화된 정본 inventory는 비어 있다. 기존 change의 execution/authoring repeat/CLI 의미를 변경하지 않고 별도 작성 기능을 추가한다.

## Impact

Engine 기준 main `8dd206a24657324c5675f4bb092d69c6ba366e7f`, 조사 시작 clean. 구현 대상은 core 작성 모듈/공개 exports/types, CLI catalog/dispatch, 별도 authoring schemas/releases, 생성·패키징·경계 검사와 테스트/공개 문서다. 새 외부 runtime dependency는 계획하지 않는다.

counterpart: Checker `qa-multi-terminal-workbench`. dependsOn: 기존 `qa-engine-modular-refactor`, `qa-bounded-authoring`, `qa-captured-variables`, Checker `qa-desktop-xml-block-studio`의 기존 제한·동등 fixture. Engine 구현은 Checker 제품 변경에 의존하지 않으며 검증된 alpha.9 인계가 Checker 새 작성 소비의 선행조건이다.

제안 runtime `0.1.0-alpha.9`, execution contract `0.3.0-draft.2` 및 execution schema bytes 유지, authoring contract `0.1.0-draft.1` 추가. Agent HTTP pin·alpha.6 기본 서버·기존 alpha.8 frozen release는 보존한다. 보고서의 기획 완료 기록을 제품 완료로 바꾸지 않는다. 원격 publish/commit/push·새 모바일 인수·운영 pin 승격은 범위 밖이다. 현재는 명세 작성이며 관리 검토 후 별도 apply한다.
