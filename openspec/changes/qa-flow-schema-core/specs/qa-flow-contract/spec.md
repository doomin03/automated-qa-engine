# 실행 계약과 Flow core

## ADDED Requirements

### Requirement: Versioned execution contracts
엔진은 모든 교환 문서의 schemaVersion을 검사하고 실행 도메인 스키마의 유일한 원본을 SHALL 제공한다.

#### Scenario: Supported path
- **WHEN** 지원되는 Flow/TC/selector/target fixture를 검증한다
- **THEN** 스키마와 cross-reference 검증이 성공하며 plan이 생성된다.

#### Scenario: Rejected or failure path
- **WHEN** 알 수 없는 schemaVersion을 입력한다
- **THEN** UNSUPPORTED_SCHEMA로 실행 전에 거부한다.

### Requirement: Bounded graph compilation
엔진은 dangling edge, duplicate id, unreachable node, cycle, 불완전 branch를 SHALL 거부한다.

#### Scenario: Supported path
- **WHEN** 유효한 start/action/assertion/end DAG를 compile한다
- **THEN** 결정적 순서를 가진 실행 계획을 생성한다.

#### Scenario: Rejected or failure path
- **WHEN** cycle 또는 누락된 branch false edge가 있다
- **THEN** INVALID_FLOW와 문제 node/edge를 반환하고 session을 열지 않는다.

### Requirement: Secrets and capability boundaries
엔진은 secret reference와 action/target allowlist 및 adapter capability를 실행 전에 SHALL 검증한다.

#### Scenario: Supported path
- **WHEN** secret resolver가 필요한 참조를 제공한다
- **THEN** 값을 로그나 결과에 기록하지 않고 adapter에 전달한다.

#### Scenario: Rejected or failure path
- **WHEN** secret 누락 또는 unsupported action을 요청한다
- **THEN** blocked 사유를 반환하며 성공으로 보고하지 않는다.

### Requirement: Deterministic execution lifecycle
interpreter는 run deadline, 제한된 retry, 취소 및 terminal 결과를 일관되게 SHALL 관리한다.

#### Scenario: Supported path
- **WHEN** 실행 중 취소 또는 runner 오류가 발생한다
- **THEN** 추가 action을 중단하고 session cleanup 뒤 cancelled 또는 infra_error를 기록한다.

#### Scenario: Rejected or failure path
- **WHEN** 부작용 action에 명시적 retry 허용이 없다
- **THEN** 실패 action을 자동 재실행하지 않는다.

