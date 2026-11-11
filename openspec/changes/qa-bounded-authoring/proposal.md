# Proposal

## Why

사용자와 AI CLI가 같은 QA 단계를 여러 번 실행하려면 현재 고유 노드를 모두 수작업으로 복제해야 한다. 제한된 반복 작성 문서를 먼저 Blueprint DAG로 펼치면 기존 실행·event identity를 유지하면서 작성량을 줄일 수 있다.

## What Changes

- `qa.authoring/v1`의 repeat(count 1..100, 순차 action/assertion steps)를 실행 전 유한 전개한다.
- 고유 node ID와 sourceMap sidecar를 만들고 원본 외부 branch·edge 의미를 보존한다.
- JSON/YAML/XML 입력과 XML 작성 API에 1MiB/깊이/위험 키/XML 구조 제한을 적용한다.
- 전개 결과 최대 1000 nodes/2000 edges 및 1MiB를 지키고 기존 compileBlueprint 검증을 통과해야 실행 대상으로 사용한다.

## Capabilities

### New Capabilities

- `qa-bounded-authoring`: 제한된 반복 입력과 deterministic DAG 전개 및 원본 대응표.

### Modified Capabilities

없음. 현재 baseline specs가 없으며 기존 runtime loop를 바꾸지 않는다.

## Impact

integrationId: qa-bounded-authoring. counterpart: automated-qa-checker의 authoring 입력/플로우 표시 소비. dependsOn: qa-flow-schema-core, qa-ai-blueprint. runtime: 0.1.0-alpha.5; contractVersion: parent가 alpha.5 통합 시 확정. 원본의 공통 실행 정책을 유지하는 사용자 승인 추가 작성 기능이다.

이 담당자는 packages/core/authoring.mjs, tests/authoring.test.mjs, docs/authoring.md와 이 OpenSpec만 수정한다. 정본 schema/공개 types/exports/CLI와 flow 한도 256→1000, edges 512→2000은 Engine 담당자가 통합한다. nested repeat, repeat body의 branch/loop, 런타임 capture, arbitrary JS/XML entity, Checker UI는 이번 변경에서 구현하지 않는다.
