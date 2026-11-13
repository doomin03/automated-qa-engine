# Spec Delta

## Purpose

실행이 취소되거나 시간 만료로 끝난 뒤에도 건강한 API 소비자가 확정된 실패와 종결 이벤트를 받을 수 있도록, 실행 예산과 실패 정리 전달 예산을 구분하고 실제 전달·정리 장애를 보존한다.

## ADDED Requirements

### Requirement: Bounded settlement delivery independent of execution cancellation
Engine은 이미 확정된 실패의 step.finished를 건강한 observer에 전달할 때 실행 AbortSignal/만료 예산과 독립된 최대1000ms를 SHALL 사용한다. 취소 또는 run timeout 자체만으로 전달 장애 진단을 만들지 않는다. terminal 전달의 별도 최대1000ms와 실행 중 callback 예산은 유지한다.

#### Scenario: Cancelled action with healthy observer
- **WHEN** action 실행 중 취소되고 callback은 정상 완료하며 adapter cleanup도 성공한다
- **THEN** callback은 cancelled step.finished와 run.finished를 순서대로 받고 result는 cancelled이며 인위적 전달 ENGINE_ERROR가 없다.

#### Scenario: Run timeout with healthy observer
- **WHEN** run deadline 소진으로 action이 TIMEOUT/run으로 끝나고 callback은 정상이다
- **THEN** 실패 정리와 terminal을 전달하며 원래 TIMEOUT/run 및 failed 판정을 유지한다.

### Requirement: Preserve real observer and cleanup failures
Engine은 실패 정리 callback의 reject/미응답을 SHALL 유한 처리하고 기존 sanitized 진단 및 최초 failure를 보존한다. 실제로 중단된 observer는 다시 호출하지 않으며 adapter cleanup의 CLEANUP_ERROR와 Agent unknown 정책은 유지한다.

#### Scenario: Rejected or unresolved settlement callback
- **WHEN** 확정된 실패 callback이 reject하거나 1000ms 안에 완료되지 않는다
- **THEN** 원래 failure를 유지하고 기존 ENGINE_ERROR 전달 진단을 기록하며 durable terminal/result와 cleanup을 완료하고 이후 callback을 호출하지 않는다.

#### Scenario: Cancel and failed adapter cleanup
- **WHEN** 취소 뒤 callback은 정상이나 adapter.endSession이 실패한다
- **THEN** 원래 cancelled를 유지하면서 CLEANUP_ERROR를 보존하고 Agent가 cleanup confirmed로 오인하지 않는다.

#### Scenario: Terminal callback failure after persisted result
- **WHEN** 결과 저장 뒤 terminal callback만 실패한다
- **THEN** 기존 ENGINE_ERROR API rejection을 유지하고 저장된 result/outcome을 바꾸지 않는다.

### Requirement: Preserve transport and immutable release contracts
Engine은 실행·작성·Agent schema bytes와 공개 event identity를 SHALL 유지하고 신규 runtime으로만 배포한다. CLI의 durable replay는 실제 전달된 sequence를 중복 출력하지 않으며 파일 오류는 callback 오류로 숨기지 않는다.

#### Scenario: CLI cancellation and replay
- **WHEN** 설치한 신규 CLI를 stdin으로 취소하고 stdout을 정상 소비한다
- **THEN** 취소 terminal/result와 exit5를 확인하고 sequence별 출력은 한 번이며 전달 실패가 있으면 기존 exit3과 durable 판정을 구분한다.

#### Scenario: Independent consumer and previous archive preservation
- **WHEN** 새 tgz를 저장소 밖 프로젝트에 설치해 API와 bin으로 실행한다
- **THEN** 실제 PASS/의도 FAIL/cancel 및 작성/Agent 호환을 검증하고 alpha.9와 이전 archive SHA가 유지된다.
