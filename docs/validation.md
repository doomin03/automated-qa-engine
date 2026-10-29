# 첫 실행 버전 검증

이 문서는 alpha.1의 역사적 검증 기록이다. 최신 alpha.2 독립 패키지·XML·lifecycle 인수는 [alpha.2 검증](validation-alpha.2.md)을 따른다.

2026-10-24, Windows / Node 24.18.0 / Playwright 1.64.1 / Chromium 156.0.8078.4.

- Dart 3.13.7 → Node runner spike: 실제 브라우저 passed/failed JSONL 수신, 정상 shutdown exit 0.
- 실제 local demo PASS/FAIL: 별도 runId로 result/events/blueprint/evidence/스크린샷 생성.
- npm run verify 성공: foundation + OpenSpec strict 3개 + bundle drift 검사 + Node tests 26/26. graph/schema/JSON·YAML·XML/secret/DTD/CLI 및 실제 browser 실행을 포함한다.
- browser 인수: 실패 selector, run timeout, 취소, browser disconnect, secret 미노출, branch 미방문, production opt-in.
- 계약 산출물: qa-contract-0.1.0-alpha.1.json, SHA-256 b9e125e56685243c82ab7e90a2f574a2538e0ea014f23f6d4035ff75fd0953f6. Checker가 public artifact의 hash를 검증하여 소비한다.
- 로컬 npm pack을 별도 임시 디렉터리에 설치하고 --version 및 실제 demo PASS/FAIL smoke 성공. tgz SHA-256: e28c61c3e3347892aa8fbafd67412eba70804c0025be2e40a906bb441aba5dfb. 원격 npm/GitHub release는 게시하지 않았다.

OpenSpec 진행: qa-flow-schema-core 8/9, qa-playwright-runner 9/10, qa-ai-blueprint 3/3. 첫 두 change의 기준 spec sync/archive는 아직 수행하지 않아 열린 상태다.

테스트에서 의도적 실패를 통과로 바꾸지 않는다. Engine는 Flutter·서버 없이 실행되며 실제 기기 Appium/TV, 원격 Agent/lease/idempotency는 이번 검증에 포함하지 않는다.
P0 조사 기록은 docs/architecture/repository-audit.md의 당시 상태다. 현재 기능은 README와 이 기록을 기준으로 한다. GitHub Actions는 작성한 workflow이며 아직 원격 실행되지 않았다.

