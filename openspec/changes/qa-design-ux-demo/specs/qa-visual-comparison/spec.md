# Spec Delta

## Purpose

사용자가 제공한 PNG 기준 이미지와 동일한 실행 조건에서 수집한 실제 웹 이미지를 명시적인 영역과 허용 오차로 비교하고 검증 가능한 차이 증거를 제공한다.

## ADDED Requirements

### Requirement: Deterministic explicit image comparison
Engine은 명시한 viewport 영역과 동일 profile의 PNG를 자동 resize 없이 비교하고 channel tolerance 및 차이 pixel 비율 한도를 SHALL 적용한다. 기준 이미지는 실행 결과로 자동 갱신하지 않는다.

#### Scenario: Difference within tolerance
- **WHEN** 크기와 profile이 일치하며 모든 비교 영역의 차이 비율이 지정 한도 이하이다
- **THEN** passed와 실제 차이 수치 및 baseline/actual/diff artifact 참조를 기록한다.

#### Scenario: Difference exceeds tolerance
- **WHEN** 비교 가능한 이미지의 차이 비율이 지정 한도를 초과한다
- **THEN** failed와 diff PNG 및 적용된 threshold를 기록한다.

#### Scenario: Missing comparable evidence
- **WHEN** 이미지 크기/profile 불일치 또는 secret 보호로 실제 PNG를 수집할 수 없다
- **THEN** blocked 사유를 기록하고 없는 이미지나 자동 보정 이미지를 성공으로 처리하지 않는다.

### Requirement: Bounded image work
Engine은 이미지 byte/pixel 제한과 decode/비교 timeout 및 취소를 SHALL 적용한다. 기준 파일 hash는 사용 직전에 확인한다.

#### Scenario: Invalid or excessive PNG
- **WHEN** 손상 PNG, 제한 초과 또는 hash 불일치가 발견된다
- **THEN** 브라우저 실행 전 입력을 거부하거나 실행 중 blocked 진단을 남기고 임의 decoder code 실행을 허용하지 않는다.

#### Scenario: Cancel during comparison
- **WHEN** 이미지 비교 중 AbortSignal 또는 run deadline이 발생한다
- **THEN** 비교 작업과 session을 제한 시간 내 정리하고 terminal 결과를 보존한다.
