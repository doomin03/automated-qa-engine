# 실제 Playwright 실행과 CLI

## ADDED Requirements

### Requirement: Standalone real browser execution
CLI는 서버와 Flutter 없이 로컬 웹을 실제로 조작하는 Playwright 실행을 SHALL 제공한다.

#### Scenario: Supported path
- **WHEN** 유효한 TC에서 launch/input/tap/assertVisible을 실행한다
- **THEN** 실제 페이지 상태가 변하고 passed result와 exit 0을 생성한다.

#### Scenario: Rejected or failure path
- **WHEN** expected assertion을 의도적으로 틀리게 바꾼다
- **THEN** failed와 실패 node/error code/screenshot 및 nonzero exit를 생성한다.

### Requirement: Machine readable transport
CLI는 JSON/JSONL stdout과 stderr diagnostics를 분리하고 실행 metadata를 SHALL 보존한다.

#### Scenario: Supported path
- **WHEN** --json으로 실행한다
- **THEN** stdout 각 record를 파싱할 수 있고 runId/attempt/sequence가 계약에 맞는다.

#### Scenario: Rejected or failure path
- **WHEN** browser driver가 실행 중 연결을 잃거나 비정상 종료한다
- **THEN** 엔진은 성공을 반환하지 않고 infra_error와 cleanup 증거를 남긴다.

### Requirement: Evidence isolation and cleanup
엔진은 artifact 경로/hash 검증과 오류·취소 시 자원 해제를 SHALL 보장한다.

#### Scenario: Supported path
- **WHEN** 동일 Flow를 두 번 실행한다
- **THEN** 서로 다른 run 경로에 immutable result/artifacts를 저장한다.

#### Scenario: Rejected or failure path
- **WHEN** timeout 또는 cancel을 발생시킨다
- **THEN** browser/driver/child를 정리하고 기존 assertion 실패를 evidence 오류로 덮어쓰지 않는다.

