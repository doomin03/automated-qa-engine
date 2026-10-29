# 실제 Playwright 실행과 CLI

## Why

엔진은 실제 브라우저와 실패 증거가 있어야 재사용 가능한 실행 제품으로 검증할 수 있다.

## What Changes

aqa validate/run/devices/doctor, local web fixture, Playwright adapter와 result/evidence 생성을 구현한다. Appium/TV 실제 구현과 GUI는 후속 단계다.

## Capabilities

### New Capabilities

- qa-local-cli: 실제 Playwright 실행과 CLI의 요구사항과 인수 시나리오.

### Modified Capabilities

없음. 현재 구현된 기준 spec이 없다.

## Impact

- integrationId: automated-qa-foundation
- contractVersion: 0.1.0-draft.1
- dependsOn: qa-flow-schema-core의 검증된 schema/interpreter/Runner port
- counterpartRepoChange: automated-qa-checker/openspec/changes/qa-flow-editor
- phase: P1

acceptanceCriteria: 아래 spec의 성공·실패 시나리오와 tasks의 실제 검증을 모두 통과해야 구현 완료다. P0에서는 기획·설계·기반 설정만 완료한다.

