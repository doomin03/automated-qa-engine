# alpha.9 작성 계약 인수

이 문서는 `qa-reusable-document-authoring` 구현 인수를 기록한다. runtime `0.1.0-alpha.9`, 실행 contract `0.3.0-draft.2`, 별도 authoring contract `0.1.0-draft.1`이다. Checker 기본 서버 alpha.6과 기존 alpha.8 Release는 자동 전환하지 않는다. 전체 회귀와 candidate-1 외부 설치 인수, 관리 교차 검토 및 Checker 작성 계약 소비를 통과하여 동일 bytes를 최종 로컬 경로에 고정했다. Checker native final과 앱 Release 인수 완료를 뜻하지 않는다.

## 기준과 구현

- 출발점: Engine main `8dd206a24657324c5675f4bb092d69c6ba366e7f`, clean. OpenSpec proposal/design/specs2/tasks strict PASS 및 관리 D1–D7 승인 후 apply.
- 새 공개 API: listTemplates/createTemplate/composeBlueprint. CLI templates list/show/create 및 compose FILE. 기본 stdout JSON envelope, --out은 파일만 exclusive 생성하고 성공 stdout 없음.
- sourceMap은 기존 Dart namespace/참조/branch exit label을 유지하며 sourceFile만 UI 보강으로 분리한다. 작성은 무실행이며 QA run은 명시 요청한다.
- source/hash, schema/semantic, 단일 target/순차 outer/internal DAG, immutable snapshot, JSON/XML 왕복, 유한 진단과 입력/출력 한도를 적용한다. 지원 범위는 [작성 API](document-authoring.md)를 따른다.

## 현재 확인한 증거

`node --test tests/document-authoring.test.mjs`: 7/7 PASS. 실제 Dart golden 정상4/거부3, JSON/XML 의미 동등성, 입력 나열 순서와 canonical XML 결정성, deep freeze, template 네 종류, secretRef, empty/compose 구분, source hash/중복 ID/원문 비노출/한도, 배포 계약 hash와 이전18파일 보존을 검증했다.

`node --test tests/document-authoring-cli.test.mjs`: 4/4 PASS. 실제 CLI 생성/compose/plan/import/export, 기존 파일·원본 보존, Windows junction/상위·절대 경로 및 UNC 사전 거부, 잘못된 UTF-8/한도/옵션/읽기·쓰기 오류와 stderr 분리, public-root의 프로세스/네트워크 부작용 차단 검사를 수행했다. tsc 6.0.3 정상 소비 exit0 및 잘못된 API/타입 소비 exit2도 확인했다.

독립 관리 감사는 `C:/workspace/QA/coordination/multi-terminal-implementation-20261112/compose-differential.json` 7/7, `compose-boundaries.json` 17/17, `cli-probe-8ugZtk/verification.json` 31/31이다. 최초 CLI 감사의 platform mismatch 기대 exit3은 감사 도구 오기였고 기존 UNSUPPORTED_CAPABILITY→exit4에 맞춰 수정 후 재검증했다. 제품 결함이나 실제 기기 인수로 보고하지 않는다.

## 보존 기준

| 대상 | SHA-256 |
| --- | --- |
| 실행 qa.schema.json | d9757da86a96a6629cd4393bf8972f1d2a58e690ff31b782e17dd6e6c16063f2 |
| Agent HTTP | 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490 |
| frozen alpha.6 tgz | 33dbcacea025fb98a52fb0411af05cb113bc85e47e84a98463912b6aace1acef |
| frozen alpha.8 tgz | 4215662445780eeecd016ad6acf2a7b2c5e16b9a4e62cf8ae88e30ee0452e77f |

이전 release/schema/Agent 18개 파일 목록과 SHA는 `tests/fixtures/document-authoring-preservation.json`, 실제 Dart source/fixture provenance는 `tests/fixtures/compose-provenance.json`에 있다.

## 전체 회귀와 독립 설치

`npm run verify`는 199/199 PASS, skip0, 224679.5889ms다. `artifacts/verify-alpha9.log`에 foundation/architecture/OpenSpec strict/contract·type drift 및 전체 회귀 로그를 보존한다.

`AQA_PACKAGE_STAGE=candidate-1 npm run test:package` 결과는 PASS다. `artifacts/package/0.1.0-alpha.9/candidate-1/verification.json`과 `pack-manifest.json`에 164개 실제 설치 파일 목록과 source/installed SHA 일치, npm이 생성한 bin의 version/help/templates 호출, TypeScript 정상·오류 소비, 기존 실행·디자인·반복·Agent·서비스 소비 인수 및 신규 documentAuthoring 증거를 기록했다. consumer는 저장소 밖 `C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-IZU0FY`이며 package 이름으로 import했다.

신규 compose 인수는 API PASS/FAIL, CLI PASS/FAIL/cancel 총5회다. 의도 FAIL은 sourceMap이 가리키는 원본 assertValue node 실패를 확인했고, 취소는 해당 generated waitFor step 시작 후 stdin JSONL 제어로 exit5/cancelled terminal/result를 확인했다. 모든 event sequence/runId와 sourceMap 대응, 두 snapshot hash, PNG6개 실제 bytes SHA를 대조했다. runtime7/design13/기존 authoring6/service3 및 optional Agent fixture도 함께 통과했다. 새 runtime의 실제 Nest/운영 Agent 승격 인수로 확대 보고하지 않는다.

취소 run `run_64aeaad3-295e-4cca-bc2e-075ae798517d`의 cleanupErrors는 비어 있지 않다. `ENGINE_ERROR`, 메시지 `Event delivery interrupted after execution failure`, phase `cleanup`, nodeId `b_44f997704dc23027d1dc1408` 한 건을 보존했다. `runtime/events.mjs`의 실패 정리 이벤트 전달에서 이미 취소된 signal을 받아 생긴 진단이며, primary CANCELLED 판정을 덮어쓰지 않는다. durable events에는 sequence7 step.finished(cancelled)와 sequence8 run.finished(cancelled)가 있고 CLI가 누락 이벤트를 replay하여 exit5로 종료했다. runner의 adapter.endSession 실패는 별도 CLEANUP_ERROR로 기록되며 이번 결과에는 없었다. 따라서 “모든 실행의 cleanupErrors가 비어 있음” 또는 “모든 OS 자식 프로세스 정리 확인”으로 해석하지 않는다. 이 fixture는 OS 후손 전수를 관측하지 않았다.

관리자는 `coordination/multi-terminal-implementation-20261112/verify-engine-handoff.mjs`로 archive SHA, 설치164파일, 두 bundle, 신규5회 result/terminal·snapshot/sourceMap 및 PNG6개 실제 bytes/SHA를 교차 대조하여 Checker 소비를 승인했다. 위 취소 진단은 정확한 메시지와 출처 노드로 구분해 인수했다. 독립 감사도 실제 설치 package 경로에서 CLI31/31(`cli-probe-85TWhJ/verification.json`), Dart차등7/7(`compose-differential-alpha9-installed.json`), API경계17/17(`compose-boundaries-alpha9-installed.json`)을 재검증했다. 이 감사 파일들은 `C:/workspace/QA/coordination/multi-terminal-implementation-20261112`에 있으며 소스 실행 증거와 설치본 증거를 분리한다.

| candidate-1 산출물 | SHA-256 |
| --- | --- |
| automated-qa-engine-0.1.0-alpha.9.tgz | 09d0669d247c18cf88c7967156f801d15e2a871eb2e2b6d740ba245d7ca933e6 |
| execution bundle | b675005334c1345ef66b47e95eb8042ce45ade23941a1a0747ef3cfc485ea335 |
| authoring bundle | c38e5c1ce5caa0242cb6bdea81460252e6594f1a2e327388e0ef4ea4eda751a1 |
| authoring schema | 8f156fb6efcb97b9ab890b78ed38c5a0beb2830bd1389fab80a10b4e6c96d226 |
| XML fixture | bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729 |

Checker 별도 alpha.9 설치와 pin/asset 164개 전체 SHA 대조는 관리 `checker-install-verification.json`에서 PASS이며, 공개 Engine compose를 실제 Dart에서 소비한 authoring-1.json은 exit0/3tests PASS다(결정성·invalid·sourceMap·unsupported·sidecar). 관리 승인 후 candidate-1의 tgz, pack-manifest.json, verification.json을 `artifacts/package/0.1.0-alpha.9`로 exclusive 복사했다. 세 파일의 후보/최종 SHA가 모두 같으며 재패킹하지 않았다. `promotion.json`에 출처와 복사 검증을 기록했고 기존 verification.json의 후보 경로도 원본 증거로 보존했다.

OpenSpec 작업11/11은 Engine 구현과 교차 작성 계약 소비 기준으로 완료했다. Checker native final/앱 Release 인수는 진행 중이며 native template 생성/schema 지원은 실제 기기 실행 증거가 아니다. 기존 운영 pin 전환·원격 npm publish/commit/push는 이 작업에서 수행하지 않는다.

오류 소비 참고: 작성 검증 실패에는 details.diagnostics 객체가 있고, 기존 CLI 공통 argv/파일 I/O 오류는 details 배열을 유지할 수 있다. 새 작성 failure schema는 전자의 구조다. 기존 공통 transport/code/exit/채널을 대체하지 않는다.
