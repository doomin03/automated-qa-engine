# 실행 계약과 Flow core

## Why

재사용 가능한 실행 규격과 graph interpreter가 없으면 Desktop/CLI/Agent가 서로 다른 테스트 의미를 갖게 된다.

## What Changes

실행 스키마·fixture, graph/selector/secret 검증, 실행 계획과 interpreter, runner port를 구현한다. 업무 권한/Slack/예약/UI는 포함하지 않는다.

## Capabilities

### New Capabilities

- qa-flow-contract: 실행 계약과 Flow core의 요구사항과 인수 시나리오.

### Modified Capabilities

없음. 현재 구현된 기준 spec이 없다.

## Impact

- integrationId: automated-qa-foundation
- contractVersion: 0.1.0-draft.1
- dependsOn: 없음; P0 문서·설정 검증 후 시작
- counterpartRepoChange: automated-qa-checker/openspec/changes/qa-flow-editor
- phase: P1

acceptanceCriteria: 아래 spec의 성공·실패 시나리오와 tasks의 실제 검증을 모두 통과해야 구현 완료다. P0에서는 기획·설계·기반 설정만 완료한다.

