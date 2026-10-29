# ADR 001 — Node 단일 런타임

상태: 첫 실행 버전에 채택, 2026-10-24. 사용자의 여러 AI CLI 연동·기능 우선 요구를 반영한다.

## 실제 검토

Dart 3.13.7을 C:/workspace/QA/.tools에 로컬로 풀고 scripts/spikes/dart-bridge.dart로 Node 24.18.0 + Playwright 1.64.1 runner를 호출했다. 실제 Chromium 페이지에 입력/클릭을 수행하여 passed, failed를 JSONL로 수신했고 shutdown exit 0을 확인했다. 전역 PATH/설정은 바꾸지 않았다.

Dart core + Node runner는 가능하다. 다만 Dart CLI와 Node runner의 두 배포물, JSONL framing/error propagation, Windows child/process tree 종료를 별도로 유지해야 한다. spike의 강제 종료 경로는 taskkill /T가 필요하며, 정상 shutdown 성공만으로 crash recovery를 전부 검증했다고 주장하지 않는다.

## 결정

첫 engine core/CLI/Playwright adapter는 Node ESM JavaScript로 작성한다. JSON Schema가 외부 데이터 경계를 검증하고 Node test runner로 계약/실행을 검사한다. TypeScript 전환은 향후 내부 타입 체계가 필요할 때 독립적으로 가능하다.
한 런타임에서 schema/plan/interpreter/browser lifecycle을 처리하여 AI CLI 설치와 Windows 배포 경계를 줄인다. Dart가 없어서 선택한 것이 아니라 실제 bridge를 검토한 뒤 초기 제품의 배포·운영 비용을 줄이는 결정이다.
Flutter는 JSON schema + CLI/Agent transport를 소비하며 엔진을 Dart로 구현할 필요가 없다. CLI는 Flutter/Slack/서버 없이 실행한다.

## 근거와 한계

[공식 Dart SDK archive](https://dart.dev/get-dart/archive)를 사용했다. browser request 정책은 [Playwright BrowserContext 문서](https://playwright.dev/docs/api/class-browsercontext)의 serviceWorkers block 및 route를 참고했다.
실제 browser disconnect/timeout/cancel은 Node 엔진 테스트에서 검사한다. 생산 런타임에는 별도 사용자 Node runner IPC가 없으므로 불완전 IPC 검사는 Checker JSONL 입력 검증으로 분리한다.

