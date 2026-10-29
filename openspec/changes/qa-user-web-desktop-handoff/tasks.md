# Tasks

## 1. XML 교환 경계

- [x] 1.1 export CLI와 엄격 XML parsing/손실 없는 serialization을 구현하고 사용자 수정 Blueprint 왕복·잘못된 XML·기존 파일 보존 테스트를 통과한다. XML 규칙/CLI 문서를 함께 갱신한다.

## 2. 버전과 배포

- [x] 2.1 alpha.2 버전·공개 bundle·XML fixture/hash를 생성하고 drift 검사를 통과한다. 기존 alpha.1 산출물 구분과 사용자 웹/Desktop 역할을 문서화한다.

## 3. 독립 패키지 API

- [x] 3.1 public core exports와 Playwright subpath, API 사용 문서·소비 예제를 제공한다. core가 구체 adapter/UI/서버 없이 import되고 검증/plan API가 동작함을 테스트한다.
- [x] 3.2 executeBlueprint의 AbortSignal/onEvent/오류·cleanup 경계를 검증하고 callback 실패·cancel·ordered versioned events/result의 의미를 API 문서에 기록한다.
- [x] 3.3 root/adapter import만으로 browser/session/child process가 시작되지 않음을 검증한다. public API .d.ts/타입 문서를 배포하고 독립 설치 TypeScript consumer의 정상/잘못된 사용 typecheck를 검증한다.

## 4. 교차 경계 검증

- [x] 4.1 실제 XML CLI PASS/FAIL·JSONL/result/evidence와 npm run verify를 통과한다. 새 코드와 전체 기존 인수의 회귀 결과를 기록한다.
- [x] 4.2 npm pack alpha.2를 sibling repo 없는 임시 consumer에 설치하여 package 이름 import 및 설치 CLI로 실제 Playwright PASS/FAIL·cancel·event/result/evidence 검증을 통과한다. tgz SHA-256/npm integrity와 bundle/fixture hash를 관리·Checker 담당에게 인계한다.

## Workflow follow-up

- Checker 실제 웹→Desktop 인수 뒤 관리 검토에서 spec sync/archive 여부를 결정한다.
- 2026-10-29 관리 명세 검토 후 7개 구현 task를 인수했다. npm run verify 39/39, 독립 tgz 소비 검증 성공. 근거는 docs/validation-alpha.2.md와 artifacts/package/verification.json이다. Checker pin 변경/교차 제품 통합은 관리 담당이 별도로 결정한다.
