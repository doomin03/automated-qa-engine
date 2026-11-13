# Tasks

관리 최소 보완 방향 승인 후 strict를 거쳐 apply한다. counterpart 소비와 운영 승격은 별도 관리 게이트다.

## 1. 실패 정리 이벤트

- [x] 1.1 정상 cancel/timeout의 callback terminal 누락을 회귀로 고정하고 독립1000ms settlement 예산을 구현한다. 건강한 callback 수신·durable sequence·인위적 진단 부재를 확인한다. (수정 전6tests 중5실패, 수정 후 신규7tests PASS; artifacts/engine-gap-20261112/settlement-before.log 및 settlement-after.log)
- [x] 1.2 실제 observer reject/hang/실행중 abort/terminal 실패, primary assertion·CLEANUP_ERROR 및 secret 원문 비노출 회귀를 검증한다. 공개 API 문서에 변경된 예산과 한계를 기록한다. (lifecycle/service-hardening/Agent child 포함 집중31 PASS, package-api 및 CLI 예산 문서 갱신)

## 2. 로컬 서비스 인수

- [x] 2.1 실제 Chromium API/CLI PASS·의도 FAIL·stdin cancel과 output replay 중복/exit를 검증하고 전체 npm run verify를 통과한다. 실패 로그는 성공 로그와 구분해 보존한다. (전체206/206 PASS/skip0, artifacts/verify-alpha10.log; 신규 회귀 수정 전 실패 로그 별도 보존. 외부 tgz 소비는2.2에서 별도 확인)
- [x] 2.2 alpha.10 신규 runtime과 bundle을 만들고 실행·작성 schema/Agent HTTP 및 alpha.9 archive 보존을 SHA로 확인한다. 별도 tgz 설치의 API/bin/types/작성/Agent 소비 증거와 파일 manifest를 고정한다. (candidate-1 동일bytes 재검증 PASS, 설치167파일 실제 SHA, 작성6실행/API healthy cancel terminal 및 CLI exit0/1/5; 초기 timeout fixture 실패와 수정 이유는 validation-alpha.10 기록)
- [x] 2.3 검증된 archive/version/hash와 취소 의미·배포 조건을 관리자에게 인계한다. 서버/Agent와 Desktop의 통합 승격은 별도 소비 인수 후라는 점을 문서화하고 strict/foundation/diff를 확인한다. (docs/architecture/alpha10-integration-handoff.md, docs/validation-alpha.10.md; 관리 exact SHA/receipt 인계, 운영 승격·실기기 미검증 구분)

## Workflow follow-up

- 기존 flow/runner sync/archive 미완료는 후속 spec 행정 작업이며 제품 실행 미구현과 구분한다.
- Appium 실기기 인수는 기존 qa-appium-adapter 3.2에 남긴다. 장치 부재를 완료로 바꾸지 않는다.
