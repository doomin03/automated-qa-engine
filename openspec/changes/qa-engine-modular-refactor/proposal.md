# Proposal

## Why

alpha.7은 서비스 경계 회귀를 통과했지만 compiler의 metadata/hash/검증 결합, runner의 실행·증거·전달·저장 결합, CLI 문서 명령의 불필요한 adapter 로딩, Agent의 복구·저장 책임 집중이 남아 있다. 전체 소스를 분류하고 실제 책임·의존 경계를 재구성해 향후 변경이 검증된 실행 계약과 자원 수명에 미치는 범위를 줄인다.

## What Changes

- 공개 진입점과 경로는 유지하면서 domain leaf, 입력 codec/검증, runtime 실행/보고, CLI command 조립, adapter session/동작, Agent state/복구/전송의 책임을 분리한다.
- 정적 import 순환·상향 의존을 자동 검사한다. worker/child 실행 경로는 정적 import와 구분해 패키지 포함 여부를 검증한다.
- 모든 기존 runtime/type/generator/script/test 파일의 이동·수정·유지 근거를 기록하고, 유지 모듈도 대응 회귀를 확인한다. 코드 가독성 개선은 책임 경계 작업과 함께 수행한다.
- 공개 API/타입/CLI/DSL/오류/순서·hash·timeout/cancel·journal v1/v2 의미를 보존하는 characterization과 alpha.7 대비 정규화 동등성 검사를 추가한다.
- alpha.7 고정 artifact와 dirty 소스를 보존하고 alpha.8 / contract 0.3.0-draft.2로 독립 소비 인수한다. schema bytes와 Agent HTTP pin은 바꾸지 않는다.

## Capabilities

### New Capabilities

- `qa-module-boundaries`: 공개 실행 동작을 보존하는 내부 모듈 의존 규칙·전체 범위 추적·패키지 포함 인수. 새로운 DSL 기능을 뜻하지 않는다.

### Modified Capabilities

없음. 기존 실행·Agent 정책 요구는 유지하며 공개 기능 의미를 변경하지 않는다. 이 change의 spec은 사용자가 요청한 구조 경계와 호환성 인수 요구만 규정한다.

## Impact

- 범위: packages/core, packages/cli, packages/agent, runners, contracts 생성 경로, scripts, tests, 사용/구조 문서.
- counterpart: automated-qa-checker / `qa-engine-refactor-compatibility`.
- dependsOn: `qa-engine-service-hardening`(178개 회귀 및 alpha.7 외부 설치 인수), 기존 실행·Agent change의 완료 요구.
- runtime: 0.1.0-alpha.8로 증분 승인. execution contract: 0.3.0-draft.2 유지. Agent protocol: 0.1.0-draft.1 / 기존8c25…149490 bytes 유지.
- 공개 `packages/cli/aqa.mjs`, core/index 및 adapter exports, contracts/schemas/qa.schema.json, versioned release 경로 유지. 신규 모듈 수에 맞춰 실제 package manifest를 다시 검증한다.
- 제외: 신규 action/플랫폼·실기기 인수, 실제 서비스 승격, Checker 기본 pin 변경, TypeScript 전면 전환, 원격 publish/commit/push.
