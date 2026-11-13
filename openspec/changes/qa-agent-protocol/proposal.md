# Proposal

## Why

Desktop이 종료되어도 지정된 머신이 승인된 QA 작업을 수행하고 중앙 진행을 전송할 수 있어야 한다. 연결 단절·Agent 재시작 때 이미 실행한 부작용을 중복 재실행하거나 물리 기기를 동시에 배정하지 않는 복구 계약이 필요하다.

## What Changes

- optional `aqa agent`와 분리된 packages/agent 모듈을 추가한다. 공개 core import와 기존 서버 없는 API/CLI 실행은 유지한다.
- Checker 정본 HTTP Agent protocol artifact를 버전/hash로 고정 소비한다. Engine 실행 schema/event/result는 계속 Engine 정본이다.
- 운영자의 로컬 target/device 허용 정책과 서버 승인 범위의 교집합에서 pinned Blueprint/Suite를 materialize하고 별도 child CLI를 명시 실행한다.
- claim/heartbeat/fencing/cancel, durable outbox/ack/reconcile을 구현한다. lease 상실 시 active run을 유한 취소/정리하며 종료를 확인하지 못한 물리 device는 quarantine한다.
- Desktop 없는 독립 프로세스로 실제 웹 PASS/FAIL/cancel 및 끊김/재시작/중복 전송 계약을 인수한다. 실제 모바일 기기가 없으면 protocol 검증과 실기기 미검증을 구분한다.

## Capabilities

### New Capabilities

- qa-agent-execution: optional Agent transport와 로컬 실행 정책·lease lifecycle·내구성 있는 복구.

### Modified Capabilities

없음. 기존 core 실행 DSL을 서버 업무 프로토콜로 대체하지 않는다.

## Impact

- integrationId: qa-agent-protocol
- counterpartRepoChange: automated-qa-checker / qa-agent-protocol
- dependsOn: qa-bounded-authoring, qa-captured-variables, qa-input-evidence-policy, Checker Registry/인증·실행 업로드 기반 및 Agent protocol artifact 고정
- runtimeVersion: 0.1.0-alpha.6 후보 인수 중, alpha.5 고정 tgz 불변
- executionContractVersion: 0.3.0-draft.1 유지; 실행 의미 변경이 필요하면 별도 관리 결정
- agentProtocolVersion: 0.1.0-draft.1, Checker 정본 SHA 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490 관리 정합
- affected: packages/agent, CLI opt-in dispatch, package files/types/docs, protocol/독립 설치 테스트. core import에는 HTTP polling/등록/파일 쓰기 부작용을 추가하지 않는다.
- acceptanceCriteria: fixed protocol schema 계약 테스트, 서버 scope∩로컬 allowlist, stale fence 거부, 끊김 취소·불확실 기기 격리, durable replay 중복 제거, restart 자동 재실행 금지, Desktop 종료 상태 독립 child CLI 실제 인수.

명세 관리 검토를 거쳐 apply 및 실제 교차 인수 중이다. HTTP endpoint/payload/TTL과 pin hash는 Checker 제안→양측 정합→Engine 소비 계약 테스트 순서로 확정했다. 최종 배포 완료 여부는 tasks와 검증 문서에서 구분한다. 신규 의존성/원격 게시/서비스 자동 설치는 포함하지 않는다.
