# Spec Delta

## Purpose

선언형 Flow의 공개 크기 한도, 실제 실행 수명과 결과 기록 한도를 일치시켜 큰 테스트 및 취소·증거 실패에서도 소비자가 신뢰할 수 있는 결과와 종료 확증을 얻도록 한다.

## ADDED Requirements

### Requirement: Valid graph sizes have representable results
Engine SHALL 최대 1000노드 Flow의 visitedNodes와 unvisitedNodes를 누락 없이 표현한다. 기존 256 이하 결과와 schemaVersion 식별자는 유지하며 공개 contract draft와 bundle을 증분한다.

#### Scenario: Maximum-size completed and interrupted flows
- **WHEN** 1000노드 유효 DAG를 완료하거나 중간 timeout/cancel한다
- **THEN** schema-valid result와 terminal을 기록하고 visited/unvisited는 중복 없이 원본 노드 전체를 분할한다

### Requirement: Run deadline is distinct from observer failure
Engine SHALL onEvent 대기 중 내부 run budget 소진을 TIMEOUT/run으로 분류하고 consumer의 독립적인 reject/전달 실패는 ENGINE_ERROR로 구분한다. 외부 cancel과 이미 결정된 실행 실패가 우선하며 persisted terminal 결과는 변경하지 않는다.

#### Scenario: Healthy output or never-resolving observer exhausts run budget
- **WHEN** 정상 JSONL 전달 또는 응답 없는 observer 대기 중 내부 run deadline이 만료된다
- **THEN** 결과는 TIMEOUT/run의 failed이고 callback이 스스로 TIMEOUT 오류를 던진 경우와 혼동하지 않는다

### Requirement: Evidence exhaustion preserves the execution result
Engine SHALL 한 실행의 공개 artifact를 최대 256개로 제한하고, 상한을 초과하는 수집은 실행 중 명시적으로 실패시킨다. 이미 확정한 artifact/hash와 원래 실패를 보존하며 cleanup 진단도 schema 한도 안에서 집약한다. 종료 확증 실패를 뜻하는 CLEANUP_ERROR는 집약으로 없어져서는 안 된다.

#### Scenario: Repeated screenshots exhaust capacity
- **WHEN** screenshot 또는 design check가 257번째 artifact를 추가하려 한다
- **THEN** 수집 한도를 알리는 실패와 유효한 result/terminal을 남기고 기존 artifact를 덮어쓰거나 무효 결과를 작성하지 않는다

#### Scenario: Many optional capture failures and cleanup failure
- **WHEN** 256개 이상의 optional evidence가 실패한 후 session cleanup도 실패한다
- **THEN** cleanupErrors는 최대 256개이며 생략 개수를 알리는 집약 진단과 CLEANUP_ERROR를 유지한다

### Requirement: Value assertions wait within a single deadline
Web/Appium SHALL assertText/assertValue의 기대값을 node의 남은 예산 안에서 기다린다. polling과 명시 retry는 deadline을 연장하지 않으며 cancel과 모호한 selector/권한/transport 등 fatal 오류를 assertion mismatch로 숨기지 않는다.

#### Scenario: Asynchronously rendered value becomes ready
- **WHEN** visible 값이 Loading에서 350ms 후 Ready로 바뀌고 node 예산이 1500ms다
- **THEN** 기대값 Ready 단언은 변경을 기다려 passed가 되고 외부 step retry 없이 종료한다

#### Scenario: Persistent mismatch and cancellation
- **WHEN** 짧은 명시 예산 안에 기대값이 나타나지 않거나 대기 중 cancel된다
- **THEN** 단언 실패 또는 취소를 유한 시간 안에 기록하며 값을 오류/로그에 유출하지 않는다

### Requirement: Session ownership survives duplicate start and interrupted creation
Adapter SHALL 중복 시작이 기존 session 소유권을 덮어쓰지 못하게 한다. Appium 생성 요청을 보냈으나 session ID 또는 삭제 성공이 미확증이면 cleanup 성공을 보고하지 않는다. Agent는 이를 unknown/quarantine으로 유지한다.

#### Scenario: Duplicate browser start
- **WHEN** 같은 Playwright adapter에 startSession을 두 번 호출한다
- **THEN** 두 번째 시작을 거부하고 endSession은 처음 소유한 browser를 정리한다

#### Scenario: Remote session creation outlives cancellation
- **WHEN** Appium 생성 요청 후 응답 전에 cancel되고 서버가 나중에 session을 만든다
- **THEN** 원래 cancelled 결과를 유지하되 CLEANUP_ERROR를 기록하며 실제 ID/삭제 확인 없이 Agent cleanup confirmed로 승격하지 않는다

### Requirement: Execution optimization preserves graph semantics
Engine SHALL compiler/interpreter 탐색을 최적화해도 immutable plan/hash, 실제 edge 순서, branch 선택, capture definite-assignment와 이벤트 identity를 보존한다.

#### Scenario: Compared plans and runs at bounded sizes
- **WHEN** 같은 100/1000노드 branch DAG와 capture 합류 fixture를 최적화 전후 검증한다
- **THEN** 의미와 이벤트 순서는 같고 측정 fixture/환경/실행 횟수와 시간·메모리를 구분해 기록한다

### Requirement: Agent retained state cannot erase uncertain execution
Agent SHALL 모든 상태 키의 최신 값과 ACK high-water를 보존하면서 중복 set 이력과 내구 ACK된 전송 payload만 안전하게 압축한다. unknown/active/pending claim·event·historical intent와 완료 tombstone은 보존한다. 압축은 실행권을 만들지 않으며 남은 용량 한계를 명시한다.

#### Scenario: Long-lived completed-job history
- **WHEN** 정상 완료된 여러 실행을 checkpoint하고 재시작한다
- **THEN** 완료 payload의 중복 이력은 축소되지만 ACK high-water와 실행 금지 tombstone은 유지하며 이전 실행을 반복하지 않는다

#### Scenario: Interrupted checkpoint with uncertain work
- **WHEN** unknown lease와 미확정 전송이 있는 상태에서 checkpoint 또는 crash가 발생한다
- **THEN** 기존 또는 새 유효 상태를 복구하며 불확실 실행을 삭제하거나 새 실행권으로 바꾸지 않는다
