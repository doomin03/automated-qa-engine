# Engine alpha.7 서비스 경계 검증

2026-11-07. main ecdb8ff 이후 기존 미커밋 작업 보존. OpenSpec `qa-engine-service-hardening`, runtime 0.1.0-alpha.7 / execution contract0.3.0-draft.2. **최신 전체178개·외부 설치·관리 대조·Checker 격리 소비 PASS 후 동일 후보3 bytes를 최종 고정했다.** alpha.2–6 frozen tgz/bundle은 변경하지 않았다. 원격 publish/commit/push 없음.

## 재현과 집중 회귀

- CLI extra positional/무관 flag/충돌 모드가 조용히 무시되는 alpha6 재현: artifacts/service-hardening/reproduction-alpha6.json. 신규 명령별 검증 회귀는 tests/service-hardening.test.mjs.
- Windows 미소비 stdout의12초 강제 종료 반례: artifacts/service-audit-20261107/backpressure-256-baseline.json. 출력 helper 적용 후 정상종료/내구 결과: backpressure-256-first-fix.json 및 독립 after.json. 후속 TIMEOUT 의미 보정은 최종 회귀 기준으로 구분한다.
- 1000노드 완료·부분 취소의 결과 분할,257번째 screenshot,998개 optional evidence 오류+cleanup 오류, 다중 check-report 사전 reservation, 지연 Web text/value, 실제 launch 중 cancel3회, stdout/stderr 정체는 tests/service-hardening.test.mjs.
- Appium 단일예산 polling/취소 및 생성 미확증: tests/appium.test.mjs와 tests/agent-child.test.mjs. 실제 설치형 CLI 자식을 소비해 cancelled+CLEANUP_ERROR→Agent unknown을 확인한다. Android/iOS 실기기 인수는 아니다.
- 독립 Appium 반례 비교: artifacts/service-audit-20261107/appium-session-cancel-after.json. 원격 session을 삭제했다고 주장하지 않으며 불확증을 정확히 기록한다.
- 실제 Chromium launch 반환을500ms 지연한 독립 비교: browser-launch-cancel-comparison.json. frozenalpha6는 result 반환 때 connected=true, 수정본은 false. 정상 output/cancel helper와 browser 후손 정리 독립 CIM 관측도 감사 디렉터리에 보존한다.
- Agent retention: 집중28tests와 artifacts/service-audit-20261107/retention-verification.json.128entry 축소한도 baseline5jobs후실패→after10jobs완료20records/6011bytes. frozenalpha6reader의v2거부/newreader재개, 관리자600ops/35checkpoint/20reopen 모델 비교 PASS.

## 계약과 후속 인수

result 노드 목록만256→1000, 공개 artifacts/cleanupErrors256 유지. schemaVersion v1과 action/event 식별자는 유지한다. 오래된 draft1 validator는 큰 결과를 거부할 수 있으므로 새 bundle pin이 필요하다. Agent HTTP artifact는 기존8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490을 유지한다.

성능은 같은 머신5회 이상 cold CLI/compile/API/browser를 분리해 측정하며 main CPU/RSS는 writer/Chromium 전체 자원값이 아니다. 전체 verify·외부 tgz·Checker 격리 소비 인수는 아래 완료 기록을 따른다.

관리 결정: Checker의 alpha7 인수는 별도 격리 설치 소비다. source/default pin·기존 Windows Release/서버/운영 Agent는 alpha6를 유지한다. 이번 작업으로 실제 서비스 배포나 기존 사용자 state migration을 수행하지 않는다.

## 후보3 독립 설치 인수

`artifacts/package/0.1.0-alpha.7/candidate-3/verification.json`과 `pack-manifest.json`이 정본이다. 외부 프로젝트 `C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-1M0tPW`에 tgz를 npm install한 뒤 공개 package 이름 import와 설치 CLI로 실행했다. tgz79파일 전체의 실제 설치 SHA와 source SHA가 같았다. npm이 생성한 bin도 해당 프로젝트에서 `npm exec --offline -- aqa --version`, `npm exec --offline -- aqa --help --json`으로 확인했다. TypeScript 정상 소비 PASS/잘못된 타입 거부 PASS다.

- tgz SHA256: `0199b719baaf2f41c46b6e6cb07dc8ddd80464923c639ed724cae612f31c80c3`
- npm integrity: `sha512-C09y35yi7EGrqTrJkXiymbhZbsPk2NdYCjkQ7HRmSKwU+OWvvCVC00wag0fmTUjSt554Gp7mo1jM1kLQoCfadQ==`
- bundle SHA256: `36ceac45564c61f5f0b442136488838299a56846992b65ce360a5ea5c4dde7fe`
- XML fixture SHA256: `bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729`
- Agent HTTP pin: `8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490` 유지.

API/CLI 실제 웹 PASS/의도적 FAIL/cancel, XML·디자인/UX·authoring/capture, Appium protocol 및 optional Agent HTTP fixture를 통과했다. 서비스 회귀는1000node PASS/exit0, 정상 출력1500ms TIMEOUT/run failed/exit1, 미소비 출력 TIMEOUT/run failed+전달실패 exit3, callback 자체 TIMEOUT→ENGINE_ERROR를 확인했다. JSONL과 durable events의 동일성·terminal/result 및 artifact hashes를 검증했다. Agent의 HTTP fixture 성공을 이번 버전의 실제 Checker 서버 인수로 표시하지 않는다.

관리자는 후보3 실제 tgz/bundle/hash, 설치79files, 최신 성능40files drift0를 독립 확인했다. 후보2→3의79파일 중 변경은 runner 하나뿐이며 `artifacts/service-hardening/candidate3-payload-diff.json`에 실제 tgz bytes 비교가 있다. 이전 alpha6 tgz SHA `33dbcacea025fb98a52fb0411af05cb113bc85e47e84a98463912b6aace1acef`, bundle `1f880001f8c653e51527ee9f92c5728aa7517b61adfb6c158d218a4a0542ed8d`는 불변이다.

## 최종 고정과 Checker 격리 소비

Checker 실제 Service 인수는2tests/6runs PASS다. 실제 웹 PASS/의도적 FAIL/350ms 지연 단언,1000node의 visited999 및 다른 분기의 unvisited997, UI 구독 일시정지 중 cancel702ms를 확인했다. 관리자는 Checker 설치79파일을 후보3 보고서와 실제 SHA 대조하고 result/terminal6쌍도 직접 확인했다. 관리 근거는 `C:/workspace/QA/coordination/artifacts/alpha7-checker-consumption-gate.json`이다. 이 인수는 기본 pin·Windows Release·서버/운영 Agent를 alpha7로 바꾸지 않는다.

최종 파일은 `artifacts/package/0.1.0-alpha.7/automated-qa-engine-0.1.0-alpha.7.tgz`이며 후보3과 정확히 같은 bytes/SHA다. 새 npm pack을 하지 않았다. 같은 디렉터리의 `verification.json`에 `promotedFrom`으로 후보3 archive/검증 경로와 복사 방식, Checker 격리 인수를 남겼다. 후보1/2/3은 삭제하거나 덮어쓰지 않았다. 관리자의 Engine 외부 실행 result/terminal29쌍과 artifact42파일 직접 대조도 mismatch0이었다.

## 전체 회귀 이력과 성능

첫 전체 `npm run verify`는 foundation/OpenSpec13/bundle/types drift PASS, tests171/176 PASS였다. 실패5개는 실제 alpha7 child에 alpha6/draft1을 요구한 Agent fixture2개, 이제 압축 가능한 같은 키20k를 사용한 quota fixture1개, 내부 observer deadline과 polling 단언의 이전 판정을 기대한2개였다. 현재 release pin, 서로 다른 retained keys20k, TIMEOUT/run 엄격 검사, failed/step 단언 경계로 수정했다. 수정한5개 집중 회귀는 모두 통과했고 전체 재실행 결과는 별도 기록한다. 제품 코드 추가 변경은 없었다.

두 번째 전체는175/176 PASS였다. browser.test의 home mismatch도 동일한 node deadline 경합으로 TIMEOUT을 받았는데 ASSERTION_FAILED만 기대했다. 짧은200ms 예산과 failed/phase step/nodeId home 검증으로 정합하고 focused PASS를 확인했다. 전체 ASSERTION_FAILED 기대값을 검색해 직접 adapter·custom primary 실패 회귀는 그대로 유지했다. 잘못된 runtime/contract/hash를 각각 거부하는 Agent 회귀1개도 추가해 단독 PASS를 확인했다. 세 번째 전체는 이177개를 기준으로 진행한다.

세 번째 `npm run verify`는177/177 PASS(163.3초), foundation82 Markdown/104 local links, OpenSpec13 strict, 공개 bundle/types drift PASS였다. 이 단계 로그는 `artifacts/service-hardening/verify-alpha7-177.log`, 두 번째 실패 이력은 `verify-alpha7-second.log`다. 전체 재실행 전에 실패 블록을 home으로 고정해 확인하는 검증까지 추가했다. 이 단계와 후보2 사이에는 제품 코드 변경이 없었다.

후보1은 마지막 service-consumer의 exit/close listener 등록 경합으로 검증도구가 code13 종료했다. 제품 PASS/FAIL로 해석하지 않는다. 후보2는 그 도구 보정과 공개 README/Agent 문서의 alpha6 실제 서버 인수·alpha7 fixture 인수 구분을 포함한다. 실제 tgz79파일 비교에서 두 공개 문서만 달랐다(`candidate-payload-diff.json`).

후보2 외부1000branch 정상 출력/run1500ms는 node n767에서 TIMEOUT/step으로 종료했다. 결과·terminal은 보존됐으나 전체 run 예산이 step.started 이후 소진된 경우의 phase 분류가 잘못됐다. 소비자 기대값을 넓히지 않고 runner가 node/run 예산 출처를 추적하도록 보완했다. 내부 budgetSignal 만료만 adapter TIMEOUT 분류에 사용하고 임의 조기 TIMEOUT은 보존한다. 해당 반례와 더 짧은 node 예산·외부 취소 회귀를 추가한 뒤 최신178개 전체 및 후보3 재인수로 검증한다. 후보1/2와 로그는 보존한다.

최신 `npm run verify`는178/178 PASS(170.2초), skip0/fail0, foundation82/104 links·OpenSpec13 strict·bundle/types drift PASS다. `verify-alpha7-final.log`가 이 runner 상태의 전체 결과다. focused provenance는 전체 run 만료/짧은 node/adapter 자체 TIMEOUT/외부 cancel의 code·phase·node identity를 분리해 확인한다.

deadline 보정 전의 독립 측정 창은 `artifacts/service-audit-20261107/final-comparison.json`이다. 파일명과 달리 최신 runner 이후 실행 측정은 아래 후속 창을 따른다. Windows/Node24.18.0, 동일 머신5회 중앙값이며 당시 runtime39파일 drift0이다.

| 항목 | alpha6 | alpha7 |
|---|---:|---:|
| cold version | 665ms | 207ms |
| cold help | 719ms | 183ms |
| validate1000 | 1227ms | 1226ms |
| plan1000 | 1079ms | 1248ms |
| 실제 Chromium256branch 실행 | 1804ms | 2007ms |

조회 시작 비용은 줄었으나 정상 실행은 출력 격리/IPC 비용으로11.3% 느려졌다. validate는 비슷하고 plan은 느려졌으므로 전체 성능 향상으로 일반화하지 않는다. main CPU/RSS는 helper/Chromium을 제외한다. 독립80case matrix PASS,6case 프로세스 관측에서 소유 helper/browser 잔존0. 동기 무한 observer, 외부 강제 종료의 전체 후손 정리, Appium 실기기 검증은 보장하지 않는다.

후보2의 deadline 분류 보정 이후에는 `artifacts/service-audit-20261107/deadline-followup-summary.json`과 `DEADLINE-FOLLOWUP.md`가 최신 실행 측정 근거다. 05:10:19.573–05:11:06.735 UTC 창에서 runtime/schema/package/lock40파일 drift0, 앞선39파일 창 대비 runner만 변경됐다. Chromium256branch5회 중앙값2014.1ms(직전2007.4ms, baseline1804ms), API1000노드5회 모두 PASS였다. 정상 출력1000branch/run1500은 TIMEOUT/run failed exit1, 짧은 예산의 미소비 출력은 TIMEOUT/run과 전달 실패 exit3, 긴 예산의 미소비 출력은 ENGINE_ERROR/infra_error exit3, 정체 후 취소는 cancelled/exit3였다. 수명6case 모두 외부 강제 kill 없이 종료했고 관측 잔류0이다. 앞선80case matrix와 query 측정은 이전 runner 창의 근거이며 최신 창의 재실행으로 가장하지 않는다.
