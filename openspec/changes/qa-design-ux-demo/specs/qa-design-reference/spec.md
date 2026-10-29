# Spec Delta

## Purpose

디자인 도구와 무관하게 내보낸 PNG 및 명시 수치 기준을 실행 환경·selector와 연결하고, 재현 가능한 비교와 판정 사유·증거를 독립 Engine 소비자에게 전달한다.

## ADDED Requirements

### Requirement: Explicit local references and profile
Engine은 사용자가 지정한 로컬 기준 리소스 hash, 수치 출처, target/selector mapping 및 viewport/DPR/font/readiness profile을 실행 전에 SHALL 검증한다. 직접 Figma 인증이나 임의 원격 리소스 다운로드를 요구하지 않는다.

#### Scenario: Reproducible reference
- **WHEN** PNG·수치 JSON의 hash와 mapping/profile이 유효하다
- **THEN** 실행 snapshot에 기준 식별과 profile hash를 고정하여 비교한다.

#### Scenario: Unsafe or inconsistent reference
- **WHEN** hash 불일치, 누락 binding, 기준 root 밖 경로 또는 symlink 탈출이 있다
- **THEN** 실행 전 거부하며 shell/임의 JS/외부 파일 접근으로 해결하지 않는다.

### Requirement: Distinct comparison outcomes
Engine은 실제 차이의 failed, 비교 조건 불일치·미지원의 blocked, 브라우저/수집 장애의 infra_error를 SHALL 구분한다. 비교하지 못한 항목은 passed가 아니다.

#### Scenario: Incomparable input
- **WHEN** 이미지 크기/profile이 다르거나 해당 관측 capability를 지원하지 않는다
- **THEN** blocked와 명시 사유를 기록하며 자동 resize·기준 교체·성공 처리하지 않는다.

#### Scenario: Runtime collection failure
- **WHEN** 지원되는 검사에서 browser disconnect나 증거 수집 장애가 발생한다
- **THEN** infra_error 또는 원래 실패를 보존한 수집 오류를 기록하고 성공을 주장하지 않는다.

### Requirement: Structured evidence and bounded execution
Engine은 기준/실제/diff PNG와 수치·행동 관측 JSON을 node/reference/profile 식별 및 hash로 연결하고 timeout/cancel/cleanup 예산을 SHALL 적용한다. 소비 callback 실패는 durable 증거 기록을 막지 않는다.

#### Scenario: Independent consumer
- **WHEN** 외부 설치 패키지가 검사 이벤트와 terminal result를 소비한다
- **THEN** 공개 schema로 각 검사 사유·측정치·상대 artifact 경로/hash를 읽을 수 있다.

#### Scenario: Cancellation or sensitive capture
- **WHEN** 비교 도중 취소되거나 secret 보호 정책이 이미지 수집을 금지한다
- **THEN** 작업을 제한 시간 내 정리하고 cancelled 또는 blocked를 기록하며 없는 이미지를 비교 성공으로 처리하지 않는다.
