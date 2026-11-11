# Spec Delta

## Purpose

사용자와 AI가 선언한 제한된 반복 단계를 고유 노드 ID의 유한 Blueprint로 전개하여 기존 QA 실행 이벤트와 결과 형식을 유지하고 원본 작성 블록의 진행 상황을 대응시킨다.

## ADDED Requirements

### Requirement: Bounded repeat authoring

시스템 SHALL qa.authoring/v1의 repeat를 count 1..100 및 비어 있지 않은 순차 action/assertion steps로 허용한다. nested repeat와 body branch/start/end는 미지원으로 거부하고, 외부 branch는 기존 의미를 유지한다.

#### Scenario: Repeat action and assertion
- **WHEN** 2개 step을 count=3으로 작성한다
- **THEN** 같은 순서의 action/assertion 6개를 고유 ID로 생성한다

#### Scenario: Unsupported repeat body
- **WHEN** repeat body에 branch 또는 다른 repeat가 포함된다
- **THEN** 실행 전에 UNSUPPORTED_CAPABILITY로 거부한다

### Requirement: Deterministic expansion and source mapping

시스템 SHALL 동일 입력을 동일 Blueprint/sourceMap으로 전개하고 원본을 수정하지 않는다. 반복의 incoming/outgoing을 첫/마지막 생성 node로 연결하며 외부 branch label을 보존한다. sourceMap은 별도 읽기용 artifact로 제공하고 실행 snapshot에 삽입하지 않는다.

#### Scenario: Existing branch enters a repeat
- **WHEN** 외부 branch의 true edge가 repeat를 가리킨다
- **THEN** true label과 기존 false 경로를 보존하고 반복 체인을 정확히 연결한다

#### Scenario: Conflicting generated identity
- **WHEN** 생성 node ID가 기존 top-level ID 또는 다른 생성 ID와 충돌한다
- **THEN** 자동 이름 변경 없이 INVALID_FLOW로 거부한다

### Requirement: Input and expansion limits

시스템 SHALL input/expanded Blueprint를 각각 1MiB, 깊이를 128 미만, 확장 node를 1000개/edge를 2000개 이하로 제한한다. count와 전개 크기를 큰 복제 allocation 전에 검증하고 cycle/예약 key/비JSON 값을 거부한다. 최종 Blueprint는 공통 schema/compiler를 통과해야 한다.

#### Scenario: Expansion exceeds limits
- **WHEN** 작은 반복 원본이 1001개 이상 node 또는 1MiB 초과 Blueprint로 전개된다
- **THEN** 전개 결과를 실행하거나 무제한 복제하지 않고 오류를 반환한다

### Requirement: Safe XML and equivalent source formats

시스템 SHALL JSON/YAML/XML의 같은 작성 정의를 동일하게 해석한다. XML은 authoring 루트의 단일 CDATA JSON blueprint payload를 사용하며 DTD/entity/unknown 또는 중복 element·attribute를 거부한다. CDATA terminator 문자열은 손실 없이 교환한다.

#### Scenario: XML round trip
- **WHEN** 입력 문자열에 CDATA terminator가 있는 authoring을 XML로 작성하고 다시 읽는다
- **THEN** 원래 값과 동일 Blueprint/sourceMap이 복원된다

#### Scenario: Duplicate XML payload
- **WHEN** blueprint payload가 2개이거나 중복 schemaVersion 속성/외부 entity가 있다
- **THEN** 어떤 payload도 실행하지 않고 INVALID_DOCUMENT로 거부한다

### Requirement: Existing runtime event identity

시스템 SHALL 확장 Blueprint만 기존 실행 API에 전달하며 runId/attempt/sequence/nodeId 형식을 바꾸지 않는다. 반복 중 실패하면 기존 first-failure 정책을 적용하고 이후 생성 노드를 unvisited로 남긴다.

#### Scenario: Repeated action execution
- **WHEN** XML authoring의 반복을 확장해 실제 브라우저에서 실행한다
- **THEN** 선언한 횟수만큼 동작하고 각 생성 node의 step event는 고유 nodeId와 순서대로 기록된다
