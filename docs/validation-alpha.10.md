# alpha.10 실패 정리 이벤트 인수

`qa-event-settlement-delivery`의 범위는 정상 취소/timeout이 건강한 API callback을 실패시키던 경로의 보완이다. source는 main/8dd206a 위의 미커밋 작업이다. alpha.9와 이전 아카이브는 불변이며 이번 작업은 원격 npm publish나 운영 서버 pin 자동 전환을 수행하지 않는다.

## 변경과 집중 증거

신규6회귀는 수정 전5실패/1통과로 실제 원인을 고정했다(`artifacts/engine-gap-20261112/settlement-before.log`). 수정 후 schema/release 보존을 포함한 신규7회귀는 PASS다(`settlement-after.log`). lifecycle/service-hardening/Agent child를 포함한 집중31회귀도 PASS다(`settlement-focused.log`). 실제 observer reject/hang, 실행 중 callback abort, terminal 실패, 최초 assertion 보존, CLEANUP_ERROR 및 Appium 생성/삭제 미확증의 unknown 의미를 유지했다.

건강한 실패 정리 callback에는 실행 signal 대신 최대1000ms의 별도 예산을 제공한다. terminal은 기존 최대1000ms다. 실제 callback 오류는 여전히 ENGINE_ERROR 진단으로 남고, adapter cleanup의 CLEANUP_ERROR는 별도다. 동기 무한 callback 점유, 외부 강제 kill의 자손 정리, 실기기 종료를 보장하지 않는다.

## 계약과 승격 조건

runtime은0.1.0-alpha.10, 실행 contract는0.3.0-draft.2, 작성 contract는0.1.0-draft.1이다. 실행·작성 schema/Agent HTTP bytes는 동일하다. 새 작성 bundle은 qa-authoring-0.1.0-draft.1-engine-0.1.0-alpha.10.json이며 authoring-release.json의 artifact/sha256으로 소비한다. alpha.9 bundle의 파일명을 추정하는 소비자는 수정해야 한다. Engine 작성 API/CLI 및 runtime 외부 소비에서 동등성을 확인한다.

전체 `npm run verify`는206/206 PASS, skip0,134305.3202ms다(`artifacts/verify-alpha10.log`). 실행·작성 schema, Agent schema/pin, alpha.9 release3개와 tgz 총8파일의 실제 SHA가 유지됐고, 새 execution/authoring bundle의 파싱된 내용 차이는 engineVersion뿐이다(`artifacts/engine-gap-20261112/preservation-after.json`). authoring metadata의 artifact 이름은 새 파일명으로 변경된다.

최초 candidate-1 외부 소비는 service-consumer의 시간 가정 때문에 실패했다(`artifacts/package-alpha10-candidate1.log`). branch-only1000노드가1500ms 안에 실행 완료되어 실제 passed였는데 fixture는 반드시 TIMEOUT/failed라고 기대했다. 초기 consumer `C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-3iZeUy`와 결과를 보존했다. 제품 payload는 수정하지 않고 timeout fixture의 n1에 존재하지 않는 selector를 기다리는10000ms waitFor를 넣어1500ms run budget을 결정적으로 소진하도록 했다. 정상1000분기 PASS와 unread stdout 정체 검사는 그대로 유지하고 failure.nodeId=n1도 검사한다.

같은 candidate-1 tgz를 새 외부 프로젝트 `C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-rI1AGJ`에 설치한 재검증은 PASS다(`artifacts/package-alpha10-candidate1-reverify.log`). archive를 재패킹하지 않았고 dry-run은 파일 inventory 조회에만 사용했다. 실제 archive SHA가 유지됐으며 설치/source167파일을 대조했다. `artifacts/package/0.1.0-alpha.10/candidate-1/verification.json`은 최초 실패와 재검증을 verificationHistory로 구분하고, npm bin/version/help/templates, 정상·오류 TS 소비, runtime/design/bounded authoring/Agent/service 및 documentAuthoring 인수를 기록한다.

새 작성 소비는 실제 Chromium API/CLI 각 PASS·의도 FAIL·cancel 총6회다. API3회는 callback sequence 전체가 durable JSONL과 같고 terminal 수신 및 browser disconnected를 확인했다. CLI3회는 stdout 전체=durable, exit0/1/5를 확인했다. 이6회는 모두 cleanupErrors[]다. 실제 observer 실패·Appium unknown은 별도 집중/전체 회귀와 외부 runtime 소비의 실패 진단으로 보존하며 모든 실행 진단이 비어 있다고 주장하지 않는다.

| 후보 정본 | 값 |
| --- | --- |
| tgz SHA-256 | 0476445261b2596954167f335968d8bbb0a513867c930553604ba9b2b1c780e3 |
| execution bundle SHA-256 | b99337961c1477549d9dd52b65f6ec888d47679f4735d3025435ee06881f93c1 |
| authoring bundle SHA-256 | 65c2510ad9ff79fe69888209f7180a7006afe9698f1721388744aee7870bb139 |
| execution schema SHA-256 | d9757da86a96a6629cd4393bf8972f1d2a58e690ff31b782e17dd6e6c16063f2 |
| authoring schema SHA-256 | 8f156fb6efcb97b9ab890b78ed38c5a0beb2830bd1389fab80a10b4e6c96d226 |
| Agent HTTP SHA-256 | 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490 |

관리자에게 exact tgz/bundle/파일 SHA와 receipt를 인계했다. Checker의 실제 서버/Agent/Desktop 통합 승격은 관리 gate와 별도 교차 인수를 거치며, 로컬 Engine 검증을 운영 전환 성공으로 확대하지 않는다. [통합 승격 인계](architecture/alpha10-integration-handoff.md)의 순서를 따른다.

다른 PC에서는 Node24/npm11 지원 범위, 정확한 tgz/bundle/hash, Chromium 설치, stdout/stderr 동시 drain, stdin 취소와 유한 종료 대기, 로컬 target/secret/device 허용 범위와 새 전용 Agent state를 확인해야 한다. 기존 사용자 state를 임의로 이전/삭제하지 않는다. Appium Android/iOS 실제 장치 인수와 TV/whitebox/recorder는 [잔여 범위 조사](architecture/remaining-engine-gaps-20261112.md)에 별도로 남긴다.
