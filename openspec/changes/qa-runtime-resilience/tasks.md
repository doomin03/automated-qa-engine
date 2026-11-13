# Tasks

## 1. Failure delivery

- [x] 1.1 실패 step.finished의 최초 observer reject/hang/abort 회귀를 추가해 기존 결함을 재현하고 최소 runner 수정 후 원래 판정·terminal·cleanup·sanitized 진단을 확인한다. 실제 Chromium 실패도 검증하고 API/review 문서를 갱신한다.

## 2. Release acceptance

- [x] 2.1 후속 CLI 개선과 함께 alpha.3 runtime/bundle/XML metadata를 고정하고 기존 alpha.2 bytes/hash 불변 및 전체 verify를 확인한다.
- [x] 2.2 독립 프로젝트에 새 tgz를 설치해 package-name API/CLI 실제 PASS/FAIL/cancel 및 실패 observer 회귀를 검증하고 버전별 pack/hash/integrity/근거를 Checker에 인계한다.

## Workflow follow-up

- CLI 후속 change와 함께 새 artifact를 한 번 발행한다. 원격 publish/commit/push 및 archive는 하지 않는다.
