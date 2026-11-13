# alpha.3 로컬 패키지 인수

2026-10-31. qa-runtime-resilience 및 qa-cli-control 적용. 공개 API/실행 schema v1과 contract 0.1.0-draft.1은 유지한다.

## 변경과 실제 검증

- 실패 step.finished 최초 observer reject/hang/abort는 기존 코드에서 3개 회귀가 실패했고 수정 후 원래 판정·cleanupErrors·terminal/result 보존을 확인했다. 실제 Chromium assertion 실패도 포함한다.
- CLI를 args/commands/execution/control/output 모듈로 나눴다. opt-in stdin cancel과 stderr 진단, durable event 누락분 출력, EPIPE 종료를 제공한다.
- `node --test tests/lifecycle.test.mjs`: 11/11 PASS.
- `node --test tests/control.test.mjs`: 16/16 PASS. Windows 실제 child pipe cancel/invalid/EOF/Suite, stdout 닫힘과 disk result 보존 포함.
- `npm run verify`: 59/59 PASS, skip0/fail0. OpenSpec 7/7, foundation 47 Markdown/65 local links, bundle/XML/type drift PASS.
- `npm run test:package`: 독립 설치 API PASS/FAIL/cancel, XML CLI PASS/FAIL, 최초 실패 observer 회귀/원문 secret 비노출, 설치 CLI stdin cancel exit5 총 7run PASS. 정상 TS 소비 typecheck 및 잘못된 사용 거부.

## 산출물 고정

| 종류 | 식별 |
| --- | --- |
| runtime | 0.1.0-alpha.3 |
| 계약 | 0.1.0-draft.1 / schema v1 |
| tgz | artifacts/package/0.1.0-alpha.3/automated-qa-engine-0.1.0-alpha.3.tgz |
| tgz SHA-256 | ea8ec57eb40d362698f3fb47bc7a583848cd3cde3e1806483b2d0a2c6ba13285 |
| npm integrity | sha512-9BUImHGbKX/bb62rTKNum4rfiMcDT7Ux74mBiwMKW6lHhSmV8bYjR149McdkZsd4t2NeQGAXRBMzaI1kZWRODA== |
| bundle SHA-256 | 84522812b8192de6e0d37bab32a6872d4cbb4573bef9da8a491bbf7608fe09aa |
| XML byte SHA-256 | bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729 |
| consumer | C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-04zxp4 |

기계 판독 verification.json과 pack-manifest.json은 위 버전별 artifact 디렉터리 안에 있다. package import 경로가 해당 consumer/node_modules로 해석되는 것을 확인했다. alpha.2 tgz SHA256 5478fae0b40b973a3f4529efc940575edb5f273821d7d5b8ca1b8a651cb0df28 및 이전 bundle/XML byte hash는 변경되지 않았다.

## 경계

Appium, 새 디자인/UX, DOM capture·반복 작성 기능은 alpha.3에 없다. 파일/OS 강제 종료 및 동기 event-loop 무한 점유는 graceful 취소 보장 밖이다. API는 취소 후 observer 전달이 중단될 수 있으며 CLI는 durable log를 검증한 후 누락 sequence를 출력한다. 이미 확정된 실패를 뒤늦은 취소가 덮어쓰지 않는다.

소스 branch main, 검토 시작 HEAD ecdb8ff87b1b45b93a38921a44d36c8adb068cd8. 기존 미커밋 리뷰 문서를 보존했고 이번 작업은 commit/push/원격 npm publish를 수행하지 않았다. Checker pin은 관리 결정으로 별도 갱신한다.
