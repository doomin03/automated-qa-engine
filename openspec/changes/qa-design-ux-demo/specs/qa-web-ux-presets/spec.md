# Spec Delta

## Purpose

사용자가 원하는 웹 대상과 기대 입력·화면을 명시적으로 매핑하면 기본 UX 검사 preset을 일반 Blueprint와 XML로 전개하여 직접 블록을 모두 작성하지 않아도 검증할 수 있게 한다.

## ADDED Requirements

### Requirement: Explicit versioned preset expansion
Engine은 선택한 local preset의 정확한 id/version/hash와 target/selector/expected binding을 검증하여 일반 Blueprint/XML로 SHALL 전개한다. 목록 조회·import·전개는 실행하지 않으며 coverage는 매핑된 대상에 한정된다.

#### Scenario: Valid user bindings
- **WHEN** 사용자가 preset 버전과 필요한 입력·selector·target을 제공한다
- **THEN** 일반 validator/compiler를 통과하는 구체 XML을 반환하고 별도 run 명령으로만 실행한다.

#### Scenario: Incomplete or unsupported bindings
- **WHEN** 필수 기대값이 없거나 지원하지 않는 capability를 요구한다
- **THEN** 자동 추정·숨은 실행 없이 진단하고 성공 coverage를 주장하지 않는다.

### Requirement: Observe before interacting with input
입력 preset은 viewport 및 sampled hit-target 관측, tap, focus assertion, input, value assertion 순서를 SHALL 유지한다. 최초 관측과 focus 검증은 fill/auto-scroll이 결함을 숨기기 전에 수행한다.

#### Scenario: Overlay blocks input
- **WHEN** overlay가 지정 관측 지점의 hit target을 가린다
- **THEN** tap/fill 전에 failed를 기록한다.

#### Scenario: Click does not focus input
- **WHEN** tap 후 지정 입력 요소가 focus되지 않았다
- **THEN** fill 이전에 failed를 기록한다.

#### Scenario: Observation limitation
- **WHEN** iframe/canvas/닫힌 shadow root 또는 실제 OS 키보드 관측을 요구한다
- **THEN** blocked로 보고하고 sampled hit-test를 전체 시각 가림의 보장으로 표현하지 않는다.

### Requirement: Web history back with explicit expectations
browserBack preset은 같은 session의 웹 history 이동 후 기대 URL과 기대 화면 selector를 SHALL 검증한다. 모바일 system back이나 키보드 닫기를 의미하지 않는다.

#### Scenario: Expected previous screen
- **WHEN** 명시한 초기 이동으로 history가 형성되고 back 후 URL과 화면이 일치한다
- **THEN** passed와 실제 URL/화면 관측을 기록한다.

#### Scenario: Wrong previous screen
- **WHEN** back 후 비교 가능한 URL 또는 화면이 기대와 다르다
- **THEN** failed를 기록하며 history가 없거나 관측 자체를 지원하지 않으면 blocked로 구분한다.
