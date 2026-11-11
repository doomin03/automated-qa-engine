# Spec Delta

## Purpose

테스트 실패를 소비자에게 전달하는 도중 추가 observer 오류가 발생해도 최초 판정과 durable 실행 결과를 보존하여 실제 실패를 조사하고 패키지 소비자가 terminal 상태를 확인하게 한다.

## ADDED Requirements

### Requirement: Preserve settled execution failure
Engine은 이미 결정된 실패의 step.finished 전달 중 최초 observer reject/미응답/취소가 발생해도 원래 failure/outcome을 SHALL 보존하고 추가 전달 문제를 sanitized cleanupErrors에 기록한다.

#### Scenario: Rejected failure observer
- **WHEN** action이 실패하고 해당 실패 event callback이 처음 reject한다
- **THEN** 원래 failure, 증가하는 JSONL sequence, evidence/result/run.finished를 보존하고 session을 정리한다.

#### Scenario: Unresolved or interrupted failure observer
- **WHEN** 실패 callback이 미응답이거나 AbortSignal로 중단된다
- **THEN** 전달 예산 내 중단하고 최초 실패를 유지하며 후속 callback을 호출하지 않는다.

### Requirement: Preserve existing error boundaries
Engine은 파일 I/O 실패를 observer 문제로 숨기지 않고 정상 경로 observer 오류 및 저장 이후 terminal callback 오류의 기존 의미를 SHALL 유지한다.

#### Scenario: Terminal delivery failure
- **WHEN** result 저장 뒤 terminal callback만 실패한다
- **THEN** 저장 판정은 그대로 두고 API는 ENGINE_ERROR로 reject한다.

#### Scenario: Independent package consumer
- **WHEN** 소비자가 새 alpha.3 tgz를 설치한다
- **THEN** 기존 선언형 입력과 schema 계약으로 실제 PASS/FAIL/cancel 및 실패 observer 회귀를 검증할 수 있으며 alpha.2 artifact는 변경되지 않는다.
