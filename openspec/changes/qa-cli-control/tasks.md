# Tasks

## 1. CLI transport

- [x] 1.1 opt-in bounded UTF-8 stdin control과 diagnostics stream을 구현하고 chunk/EOF/unknown/malformed/크기/정리 단위 테스트 및 기본 transport 회귀를 통과한다. 공개 CLI 문서를 함께 갱신한다.
- [x] 1.2 Windows 실제 child pipe에서 Chromium 실행 중 cancel/잘못된제어/빈 EOF의 result·terminal·exit 및 종료를 검증한다. run-suite 취소도 후속 case를 시작하지 않는지 확인한다.

## 2. Distribution

- [x] 2.1 qa-runtime-resilience와 함께 alpha.3 독립 tgz를 설치해 명령·타입·실제 PASS/FAIL/cancel·observer 회귀를 검증하고 정확 runtime/contract/hash/control 옵션을 Checker에 전달한다.

## Workflow follow-up

- 이후 디자인/UX와 복합 XML 작성·Appium은 별도 change로 구현하며 이 완료 상태와 혼용하지 않는다.
