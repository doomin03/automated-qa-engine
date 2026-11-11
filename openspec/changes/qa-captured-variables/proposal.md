# Proposal

## Why

사용자는 XML로 복잡한 테스트를 작성하면서 화면에서 얻은 공개 값을 후속 입력·검사·분기에 재사용해야 한다. 고정 literal만 가능한 기존 기능을 선언형 데이터 흐름으로 확장한다.

## What Changes

- web captureText/captureValue와 명시 public captured variable을 추가한다.
- DAG 모든 도달 경로의 definite assignment를 검사하고 값은 runtime에만 보존한다.
- 반복 작성의 확장 Blueprint에서 같은 변수의 재할당을 지원한다. 실패한 capture는 이전 값을 재사용하지 않는다.
- 비밀 참조와 capture 혼용, 민감 DOM 및 과대 관측은 거부한다.

## Capabilities

### New Capabilities

- qa-captured-variables: 유한 그래프의 공개 DOM 값 수집과 데이터 흐름 검증.

### Modified Capabilities

없음. 기존 change 계약을 호환 확장한다.

## Impact

- integrationId: qa-captured-variables
- contractVersion: 0.3.0-draft.1 (runtime 0.1.0-alpha.5)
- dependsOn: qa-bounded-authoring / qa-design-ux-demo
- counterpartRepoChange: automated-qa-checker의 고정 Engine contract 소비
- acceptanceCriteria: 모든 경로 초기화, secret/password/OTP 차단, 값 비노출, 실제 웹 capture→입력/assert/branch 및 외부 설치 XML PASS/FAIL.
- 범위: core schema/compiler/runner, Playwright, API/types/CLI. 모바일 capture와 임의 JS는 미지원.
