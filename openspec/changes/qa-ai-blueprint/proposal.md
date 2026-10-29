# AI CLI 및 Blueprint 입력

## Why

사용자는 수동 블록 조립 없이 Claude/Codex 등 다양한 CLI에서 QA Flow를 생성·수정하고 GUI에서 진행을 확인하려 한다. 공급자와 무관한 문서 입력/검증/진행 이벤트를 구현한다.

## What Changes

- qa.blueprint/v1 bundle에 Flow/selector/target/TC를 묶는다. JSON/YAML은 정본 구조, XML은 같은 구조로 변환하는 입력이다.
- schema/template/import/validate/plan 명령으로 어떤 AI CLI도 규격을 알아내고 오류를 수정할 수 있게 한다.
- 외부 AI CLI 실행과 API key 관리는 이번 작업에 포함하지 않는다. AI가 만든 문서의 가져오기는 자동 실행을 뜻하지 않는다.
- Checker에 기본 Blueprint 그래프·실행 event 재생 기능을 추가하고 시각 디자인은 후속으로 둔다.

## Capabilities

### New Capabilities

- qa-ai-blueprint: 공급자와 무관한 선언형 입력과 사용자 실행/진행 확인 정책.

### Modified Capabilities

없음.

## Impact

- integrationId: automated-qa-foundation
- contractVersion: 0.1.0-draft.1
- dependsOn: qa-flow-schema-core / qa-playwright-runner
- counterpartRepoChange: automated-qa-checker/openspec/changes/qa-ai-blueprint
- acceptanceCriteria: 같은 JSON/YAML/XML의 plan 의미가 같고 잘못된 입력은 실행 전에 거부되며 event는 노드 진행으로 표시된다.

