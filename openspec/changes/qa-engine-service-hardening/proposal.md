# Proposal

## Why

alpha.6 독립 패키지는 실제 웹/Agent 인수를 통과했지만 서비스 소비 감사에서 미소비 Windows 출력 pipe가 timeout/cancel을 막는 현상, 유효한 큰 Flow의 결과 직렬화 실패, 비동기 화면 값의 즉시 단언 실패가 재현됐다. 기존 실행 DSL과 독립 패키지 경계를 유지하면서 이 실패들을 유한 종료·내구 결과·예측 가능한 CLI 사용으로 보완한다.

## What Changes

- CLI 명령별 positional/flag 검증, 충돌 거부, 가벼운 질의의 lazy dispatch를 적용한다. 잘못된 인자를 조용히 무시하던 호출은 명시 INVALID_ARGUMENT/exit 2가 된다.
- Windows 동기 pipe write를 실행 event loop 밖에 격리하고 출력 message/queue/deadline을 제한한다. 전송 중단은 실행 재시도를 유발하지 않으며 디스크 결과와 전달 오류를 분리한다.
- 실행 graph 최대 1000개와 result 노드 목록 한도를 정합한다. artifact/cleanup 한도는 무조건 늘리지 않고 초과 시에도 유효한 terminal/result를 남긴다.
- Web/Appium text/value 단언은 같은 node deadline 안에서 기대값을 기다리며 cancel/fatal 오류를 보존한다. adapter session 중복 시작은 기존 session을 잃기 전에 거부한다.
- compiler/interpreter의 측정된 반복 탐색만 인덱스화하고 실행 순서·hash·branch·captured-variable 검증을 유지한다. cold CLI와 100/1000-node API/CLI 측정을 분리한다.
- alpha.6 산출물은 불변 보존하고 alpha.7 후보 및 새 execution contract draft를 만들어 독립 설치/Checker 소비 인수 후 고정한다. 현재 구조/제한 문서를 코드와 맞춘다.

## Capabilities

### New Capabilities

- `qa-service-cli`: 서비스 소비 CLI의 입력 검증, 출력 전달과 실행 수명 분리, 가벼운 질의 시작 비용.
- `qa-bounded-execution-results`: 허용된 graph와 내구 결과/증거 한도의 정합 및 유한 session/단언 수명.

### Modified Capabilities

없음. 현재 `openspec/specs` 정본 목록은 비어 있으며 기존 동작은 미보관 change에 있다. 기존 qa-runtime-resilience, qa-cli-integration, qa-bounded-authoring, qa-agent-protocol 등의 완료 사실은 변경하지 않고 이번 delta에서 서비스 경계를 추가한다.

## Impact

- 소유: automated-qa-engine. Counterpart: automated-qa-checker(공개 artifact 소비). 관리자가 성능 감사 담당에게 packages/agent/store.mjs와 tests/agent-service-retention.test.mjs, tests/agent-store.test.mjs, tests/agent-checkpoint.test.mjs만 별도 소유 배정했다. Engine 담당은 이 네 파일을 편집하지 않고 나머지 제품 변경과 통합 검증을 소유한다.
- dependsOn: 기존 alpha.6 공개 패키지/qa-agent-protocol 및 서비스 감사 재현. 계약 제안은 runtime `0.1.0-alpha.7`, execution contract `0.3.0-draft.2`; Agent HTTP `0.1.0-draft.1`/기존 pin은 유지한다. 버전은 관리 검토 뒤 확정한다.
- 변경 예상: packages/cli, core compiler/runner/schema, Playwright/Appium adapter, tests, 공개 types/bundle/release metadata, API/CLI/architecture 문서. 새 runtime dependency는 계획하지 않는다.
- 기존 문서/작업 트리 및 frozen alpha.2–6/candidate는 보존한다. 원격 publish/commit/push, Checker 제품 수정, 새 action/임의 JS, 실제 모바일 기기 확보, 중앙 서버 기능 확대는 범위 밖이다.
