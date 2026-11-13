# Proposal

## Why

Windows Desktop이 pipe로 시작한 Engine은 signal 대신 이식 가능한 graceful 취소 채널이 필요하다. CLI 기본 출력 호환을 유지하면서 event와 오류를 분리할 선택지도 제공한다.

## What Changes

- run/run-suite에 명시 --control-stdin JSONL cancel 입력을 제공한다.
- --diagnostics stdout|stderr로 오류 출력 위치를 선택하고 기본 stdout을 유지한다.
- 잘못된/과대/비정상 UTF-8 제어는 sanitized 진단과 실행 중단으로 처리한다. 빈 EOF는 취소하지 않는다.
- 설치된 aqa 명령 및 Windows 실제 child pipe의 terminal/result/exit 인수를 alpha.3에 포함한다.

## Capabilities

### New Capabilities

- qa-cli-control: 선택적 로컬 stdin 제어와 CLI 진단 transport 호환성.

### Modified Capabilities

없음. baseline specs 없음.

## Impact

- integrationId: qa-cli-control
- contractVersion: 0.1.0-draft.1 (실행 schema 불변)
- dependsOn: qa-runtime-resilience / qa-user-web-desktop-handoff
- counterpartRepoChange: automated-qa-checker/qa-user-web-desktop-handoff
- acceptanceCriteria: Windows child pipe에서 cancel→cancelled result/terminal/exit5, EOF 무취소, malformed/UTF8/limit 거부, 기본 stdout 및 stderr 선택, 설치 tgz 검증.
- CLI/tests/docs만 확장하며 stdin은 임의 명령/secret 전달 transport가 아니다. alpha.3 신규 runtime, alpha.2 artifact 보존.
