# Spec Delta

## Purpose

래스터 이미지에서 임의의 정답을 추정하지 않고 사용자가 명시한 출처와 수치 기준으로 실제 웹 요소의 위치·크기·간격·허용 CSS 값을 관측하고 비교한다.

## ADDED Requirements

### Requirement: Explicit CSS pixel measurements
Engine은 bbox x/y/width/height, 두 요소 사이의 방향성 gap, computed font-size를 최소 whitelist로 SHALL 제공한다. 기대값·절대 허용 오차·출처는 hash 고정 JSON으로 명시하며 단위는 CSS px이다.

#### Scenario: Numeric measurement match
- **WHEN** 유일한 selector가 해석되고 측정값과 기대값의 절대 차이가 허용 오차 이하이다
- **THEN** passed와 expected/actual/tolerance/source를 기록한다.

#### Scenario: Numeric difference
- **WHEN** 비교 가능한 수치가 허용 오차를 초과한다
- **THEN** failed와 해당 rule/selector 및 실제 차이를 기록한다.

#### Scenario: Unsupported quantity
- **WHEN** whitelist 밖 style이나 해석할 수 없는 단위 또는 iframe/canvas 내부 측정을 요구한다
- **THEN** 실행 전에 거부하거나 blocked로 보고하며 임의 JS 실행이나 추정값으로 대체하지 않는다.

### Requirement: Observation without layout correction
Engine은 측정 시 click/fill/auto-scroll을 실행하지 않고 viewport 좌표와 DPR에 따른 PNG 좌표의 변환을 SHALL 명시한다.

#### Scenario: Target outside viewport
- **WHEN** 검사 대상이 viewport 밖에 있다
- **THEN** 원래 위치를 관측하며 화면 안으로 자동 이동시킨 값을 정상 상태로 보고하지 않는다.

#### Scenario: Raster and CSS units differ
- **WHEN** DPR이 1이 아니거나 디자인 export 배율이 다르다
- **THEN** 선언한 CSS 영역과 pixel 크기의 일치 여부를 검증하며 PNG pixel을 CSS px 기대값으로 임의 추론하지 않는다.
