# Proposal

## Why

alpha.2의 action 실패 처리 중 최초 step.finished observer 오류는 result/terminal 저장을 건너뛴다. 재현된 결함을 고쳐 원래 판정과 결과 증거를 보존하고 독립 패키지 소비자에게 수정 버전을 제공한다.

## What Changes

- 실패 처리의 observer reject/미응답/취소가 원래 실패·cleanup·terminal 기록을 막지 않게 한다.
- 추가 observer 문제는 기존 cleanupErrors에 sanitized 진단으로 기록한다. 파일 I/O 실패를 observer 문제로 삼키지 않는다.
- 기존 입력/schema/정상 경로 및 terminal callback 실패 의미는 유지한다.
- 신규 runtime alpha.3 및 독립 tgz 소비 인수를 제공하고 alpha.2 파일을 보존한다.

## Capabilities

### New Capabilities

- qa-runtime-resilience: 실패 전달 중 observer 문제에 대한 원래 판정·durable 결과 보존.

### Modified Capabilities

없음. 기준 specs가 없으며 기존 qa-reusable-package change의 lifecycle 보장을 보완한다.

## Impact

- integrationId: qa-runtime-resilience
- contractVersion: 0.1.0-draft.1 (필드 변경 없음)
- dependsOn: qa-user-web-desktop-handoff
- counterpartRepoChange: automated-qa-checker/qa-user-web-desktop-handoff (새 runtime pin은 별도 인계)
- acceptanceCriteria: 실패 직후 최초 observer reject/hang/abort, 실제 Playwright 실패, 정상 lifecycle 회귀와 외부 alpha.3 설치 API/CLI PASS/FAIL/cancel을 검증한다.
- 변경은 runner/tests/docs/신규 runtime metadata이며 CLI transport·디자인/UX·Appium은 후속 change다. commit/push/publish는 하지 않는다.
