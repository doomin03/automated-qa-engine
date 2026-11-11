# Proposal

## Why

리뷰에서 local 문서 참조의 명시 경계와 screenshot 수집 불가의 판정을 보완할 필요가 확인됐다. 기존 상대 경로와 best-effort 실행을 유지하면서 엄격한 선택 정책을 제공한다.

## What Changes

- 기존 bounded 1 MiB read에 documentRoot/--document-root realpath containment를 연결한다.
- screenshot.params.required를 추가하고 optional 수집불가는 skipped, required 수집불가는 blocked/infra_error로 구분한다.

## Capabilities

### New Capabilities

- qa-input-evidence-policy: 명시 문서 root와 증거 필수 여부 정책.

### Modified Capabilities

없음. 기존 기본 정책은 호환 유지한다.

## Impact

- integrationId: qa-input-evidence-policy
- contractVersion: 0.3.0-draft.1 (runtime alpha.5)
- dependsOn: qa-runtime-resilience / qa-design-ux-demo
- counterpartRepoChange: automated-qa-checker의 고정 Engine contract 소비
- acceptanceCriteria: root 내부 TC/Suite/selector/target 성공·탈출/symlink 거부; 실제 skipped/blocked/infra events와 결과.
