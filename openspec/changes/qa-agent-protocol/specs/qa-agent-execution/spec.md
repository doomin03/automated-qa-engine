# Spec Delta

## Purpose

Desktop과 중앙 서버 의존 없이 재사용하는 기존 Engine을 보존하면서, 명시적으로 시작한 Agent가 승인된 작업을 실행하고 연결 단절·재시작 때 중복 부작용과 물리 기기 동시 제어를 방지하는 운영 계약을 제공한다.

## ADDED Requirements

### Requirement: Optional agent execution
Engine은 optional Agent 명령을 SHALL 제공하고 core import 및 기존 로컬 API/CLI에 서버 연결·등록·polling을 강제하지 SHALL 않는다.

#### Scenario: Independent local consumer
- **WHEN** 소비자가 서버 설정 없이 package를 import하여 로컬 Blueprint를 실행한다
- **THEN** Agent transport 부작용 없이 기존 실행이 가능하다.

#### Scenario: Desktop closed
- **WHEN** 운영자가 별도 Agent 프로세스를 명시적으로 시작하고 Desktop은 종료되어 있다
- **THEN** 승인된 job은 Agent가 독립적으로 실행하고 실제 결과를 서버에 전달한다.

### Requirement: Pinned protocol and original identities
Agent는 Checker 정본 protocol version/hash와 Engine 정본 실행 schema를 SHALL 각각 검증하며, 서버 배정 identity와 원본 Engine event identity를 SHALL 구분한다.

#### Scenario: Suite event delivery
- **WHEN** 하나의 lease에서 여러 case가 서로 다른 Engine runId를 생성한다
- **THEN** case와 lease 전송 순번으로 묶되 Engine runId/attempt/sequence를 변경하지 않고 연속 ack cursor로 중복 전송을 제거한다.

#### Scenario: Contract mismatch
- **WHEN** protocol pin 또는 Engine snapshot/schema가 기대 값과 다르다
- **THEN** 브라우저나 앱을 시작하지 않고 불일치를 명시적으로 보고한다.

### Requirement: Local operator target policy
Agent는 서버 승인 범위와 운영자의 로컬 target/device/production/credential 허용 범위의 교집합에서만 SHALL 실행하고 로컬 허용 목록의 기본값은 빈 목록이어야 SHALL 한다.

#### Scenario: Server target outside local policy
- **WHEN** 서버 job의 origin/native app/resource가 로컬 정책에 없다
- **THEN** 실제 side effect 없이 거부하며 서버 권한만으로 정책을 확장하지 않는다.

#### Scenario: Unapproved secret reference
- **WHEN** 서버 Blueprint가 운영자 credential/secretRef allowlist에 없는 참조를 요구한다
- **THEN** 호스트 환경에 값이 있어도 전달하지 않고 실행 전에 거부한다.

### Requirement: Pinned input materialization
Agent는 실행 전 완전한 case별 Blueprint와 자산을 hash·size·path 검증한 격리 디렉터리에 SHALL 준비한다.

#### Scenario: Escaping or changed resource
- **WHEN** 자료가 절대 경로·상위 탈출·symlink·알 수 없는 외부 URL 또는 hash 불일치를 포함한다
- **THEN** 호스트 파일을 읽거나 실행하지 않고 거부한다.

### Requirement: Lease cutoff and fencing
Agent는 유효한 lease/fence 아래에서만 SHALL 실행하며 heartbeat cutoff 또는 취소 신호 시 active child를 유한 취소·정리하고 후속 case를 시작하지 SHALL 않는다.

#### Scenario: Network lost during run
- **WHEN** heartbeat를 안전 시간 안에 갱신할 수 없다
- **THEN** 서버 재연결을 기다리며 계속 조작하지 않고 로컬 취소를 요청한다.

#### Scenario: Stale owner
- **WHEN** 서버가 현재 lease의 fence를 거부한다
- **THEN** Agent는 실행을 중단하고 stale 결과를 새 실행의 결과로 바꾸지 않는다.

### Requirement: Quarantine uncertain resource
Agent와 서버는 lease 만료만으로 종료 불명 물리 resource를 재사용하지 SHALL 않으며 실제 종료 확인 전 quarantine을 SHALL 유지한다.

#### Scenario: Unknown native session after timeout
- **WHEN** child 또는 Appium session 정리 성공을 확인할 수 없다
- **THEN** 동일 resource에서 새 job을 실행하지 않고 운영자의 종료 확인과 reconcile을 요구한다.

### Requirement: Single active agent instance
Agent는 로컬 state의 단일 writer와 서버의 instance ownership을 SHALL 확인하고 같은 Agent identity의 두 프로세스에 동일 작업 실행 권한을 부여하지 SHALL 않는다.

#### Scenario: Duplicate agent startup
- **WHEN** 같은 agentId를 사용하는 새 instance가 이전 instance의 lease를 조회한다
- **THEN** 조회를 실행 허가로 취급하지 않고 기존 실행 종료 확인 전 새 실행을 거부한다.

#### Scenario: Uncertain stale lock
- **WHEN** lock에 기록된 기존 프로세스가 없다고 확증할 수 없다
- **THEN** lock을 자동 삭제하지 않고 명시적인 운영 확인을 요구한다.

### Requirement: Durable recovery without reexecution
Agent는 실행 intent와 전송 outbox/ack를 내구성 있게 SHALL 보존하고 restart/retry를 기존 부작용 재실행으로 취급하지 SHALL 않는다.

#### Scenario: Claim response lost
- **WHEN** claim 응답이 유실되어 같은 요청을 다시 보낸다
- **THEN** 동일 claim identity로 복구하며 두 번째 job을 별도로 실행하지 않는다.

#### Scenario: Restart after side effect
- **WHEN** job 실행을 시작한 Agent가 결과 전송 전에 재시작한다
- **THEN** 서버와 reconcile하고 기존 증거를 재전송하거나 resource를 격리하며 작업을 자동 재실행하지 않는다.

### Requirement: Truthful result and transport status
Agent는 실제 Engine 판정과 전송/업무 상태를 SHALL 구분하고 누락 result/terminal을 성공 또는 합성 Engine 결과로 대체하지 SHALL 않는다.

#### Scenario: Child fails before result
- **WHEN** preflight 거부 또는 child crash로 Engine result가 없다
- **THEN** 실행 실패/미확정 업무 상태를 보고하고 존재하지 않는 Engine result나 terminal을 만들지 않는다.

#### Scenario: Upload retry
- **WHEN** 완성된 실제 result 업로드의 ack가 유실된다
- **THEN** 같은 고정 result/event/artifact를 멱등 재전송하며 테스트를 다시 실행하지 않는다.

### Requirement: Bounded durable idle operation
Agent는 confirmed empty claim의 불필요한 누적으로 유휴 대기만으로 journal 한도에 도달하지 않도록 SHALL checkpoint하며 불확정 실행·전송 자료를 삭제하지 SHALL 않는다.

#### Scenario: Long empty queue polling
- **WHEN** 서버가 연속 claim에 확정된 HTTP 204를 반환한다
- **THEN** single-writer/fsync/atomic replace로 해당 완료 empty claim 기록만 retire하고 다른 journal operation과 실행 identity를 보존한다.

#### Scenario: Crash around journal replace
- **WHEN** checkpoint의 write/fsync/replace/reopen 전후에 프로세스가 종료된다
- **THEN** 다음 시작은 완전한 이전 또는 새 journal에서 복구하며 unknown claim, active lease, pending events/history/receipts를 잃거나 재실행하지 않는다.

### Requirement: Explicit operator recovery without result fabrication
Agent는 Checker의 명시적 운영자 복구 증거를 SHALL 검증하고 이를 기존 QA 결과·cleanup 확증 또는 이전 실행권으로 바꾸지 SHALL 않는다.

#### Scenario: Recovered uncertain resource
- **WHEN** 운영자가 이전 process/session 종료를 확인한 복구 기록과 증가한 resource fence가 전체 reconcile에 포함된다
- **THEN** Agent는 로컬 이전 process 부재와 pinned 복구 계약을 확인해 미확정 이력을 recovered로 닫되 기존 outcome/cleanup 상태를 보존하고 새 identity의 실행만 허용한다.

#### Scenario: Mixed normal completion and recovered lease
- **WHEN** 같은 이전 owner에 receipt 미ACK인 정상 closed lease와 operator recovered lease가 함께 있다
- **THEN** 정상 receipt 검증·ACK는 유지하고 recovered를 receipt 합성 없이 처리하여 서버 독립 검증 후 owner를 retire한다.
