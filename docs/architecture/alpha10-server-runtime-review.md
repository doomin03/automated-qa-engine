# alpha.10 서버 runtime 독립 읽기 검토

검토일: 2026-11-13. Engine main HEAD `8dd206a24657324c5675f4bb092d69c6ba366e7f`, 작업 루트 `C:/workspace/QA/automated-qa-engine`. Checker 파일은 읽기만 수행했다. 이 검토에서 서버/브라우저/Flutter를 실행하거나 기존 사용자 DB·Agent state를 변경하지 않았다. alpha.10 payload와 locator apply 보류 상태를 유지한다.

## 설치와 상태 보존

Checker `apps/server/scripts/server-runtime.mjs`는 CLI/manifest override를 함께 요구한다. demo/admin 기본값을 같은 alpha.10 설치 및 canonical manifest로 통일했다. `guardRegisteredRuntime`은 Platform/Agent startup 전에 DB를 readOnly로 열어 기존 Agent 등록 version/contract hash/version 불일치를 거부한다. 이는 demo 보호이며 운영 서버의 자동 migration 기능이 아니다.

`prepare-server-runtime.mjs`는 명시 archive SHA를 먼저 확인하고 별도 staging에 설치한다. `verifyServerRuntime`은 package 파일의 정확 집합과 SHA, execution bundle SHA/contract version, 실제 CLI version을 비교한다. 기존 설치는 덮지 않고 다시 검증하며 receipt pin 불일치를 거부한다. `.local/engine`의 alpha.6과 Desktop 설치는 교체하지 않는다.

독립 읽기 대조 결과:

- canonical `packages/contract/runtime/engine-runtime.json`의 167개 파일과 Engine candidate-1의 `verification.installedFiles` 167개가 정확히 일치했다.
- Checker `.local/engine-server-alpha10/node_modules/automated-qa-engine`의 해당 167개 실제 파일 SHA를 다시 읽어 불일치 0개를 확인했다. 추가 파일 거부는 installer의 exact inventory 비교 및 담당자 회귀가 맡는다.
- archive pin `0476445261b2596954167f335968d8bbb0a513867c930553604ba9b2b1c780e3`, execution bundle pin `b99337961c1477549d9dd52b65f6ec888d47679f4735d3025435ee06881f93c1`가 원본 검증 보고서와 같다.
- 설치 receipt의 fileCount는 167, manifest SHA는 `2be7b673eb9df528b824bee42b28b8de90580ded466e5dad935fff083d925afc`였다. 이를 사용자 PC의 설치 또는 실제 운영 배포 완료로 확대하지 않는다.

## 실제 통합 harness 검토

`apps/server/scripts/verify-runtime-integration.mjs`는 새 임시 DB에서 alpha.6 실제 기록을 수신한 뒤 alpha.10 서비스로 다시 시작한다. 기존 version/Run/events/Agent/job/lease를 비교하고 old runtime 신규 Run 및 old Agent credential의 새 runtime claim 거부를 검사한다. 옛 lease는 장치 실행이 없는 blocked protocol fixture로 명시했다. active/unknown lease 보존을 별도로 실행한 증거는 아니며 그러한 자동 승격을 주장하지 않는다.

전체 경로는 실제 Chromium 결과·PNG HTTP 전송/권한/다운로드, 새 Agent identity/state, 두 case Suite, 제어 clock 예약, stopOnFailure, assertion 시작 이후 취소를 수행하도록 구성되어 있다. sampled PID/creation time 관측과 전체 프로세스 누수 증명의 차이도 receipt에 명시한다. `agent --once` exit 0은 전달 업무 완료이며 QA PASS와 다르므로 reportedExecutionStatus와 각 Run outcome을 따로 검사하는 구성이 적절하다.

조회 당시 latest receipt `artifacts/runtime-alpha10/run-zbuQ38/verification.json`은 **history-only PASS**였다. 새 Chromium/Agent 전체 인수가 완료됐다는 증거로 사용하지 않는다.

## 요청한 인수 보강

서버 담당과 관리자에게 다음 두 가지를 전달했다. 제품 결함 판정이 아니라 최종 인수의 명시 assertion 누락이다.

1. `completeExecution`의 receipt 존재와 lease.closed만으로 receipt ACK와 resource 해제·owner retired를 직접 확인했다고 보고할 수 없다. DB의 `receipt_acked`, 해당 resource의 `lease_id`, owner instance 상태를 추가 대조하여 기록한다.
2. cancel 경로는 outcome/cleanup confirmed 외에 수신 terminal·result identity와 `cleanupErrors`, evidence verified, completion receipt ACK를 대조한다. 특히 alpha.10 변경 목적은 정상 취소에서 불필요한 settlement ENGINE_ERROR가 사라지고 terminal을 전달하는 것이므로, outcome만으로 이 차이를 인수하지 않는다. 진짜 cleanup 실패를 성공으로 변경해서는 안 된다.

이전 경계 검토에서 지적한 demo/admin 기본 경로 불일치와 authoring filename 하드코딩은 현재 새 도구와 metadata reader에서 보완된 것을 확인했다. 역사 alpha.6 도구/fixture는 그대로 역사 자료로 유지한다. source/provider 및 exact pin 검사를 우회할 필요는 없다.

실제 전체 실행과 보강 assertion 결과는 Checker 담당자의 후속 receipt를 따른다. 본 문서는 [기존 소비 경계 검토](alpha10-checker-boundary-review.md)와 [alpha.10 Engine 인수](../validation-alpha.10.md)를 보완한다.

## 최종 증거 확인 — 2026-11-13

앞 절의 history-only 상태는 최초 검토 시점의 기록이다. 후속 실제 통합 증거를 읽어 위 두 인수 요청이 **모두 해결됨**을 확인했다. 제품 테스트를 재실행하거나 SQLite를 다시 조회하지 않았으며, 아래 원본 보고서 내용과 파일 SHA를 대조했다.

- Checker `artifacts/runtime-alpha10/acceptance.json`: 전체 인수 passed, 실제 Run 7개(PASS 5·의도 FAIL 1·취소 1), PNG 6개, ACK 완료 lease 4개, SDK 339개 drift 0. `pnpm run verify` exit 0(server 56/56·TS 12/12)은 마지막 예약 demo 설정/문서 수정 전 실행이며, 이후 별도 syntax·server-runtime 회귀·foundation·lint·strict 결과가 기록되어 있다.
- `artifacts/runtime-alpha10/run-unCN6f/verification.json`: 실제 Suite·예약 Suite·stopOnFailure·취소의 네 lease 모두 `receiptAcknowledged/resourceReleased/ownerRetired=true`를 기록했다. SHA `30fd5ab30ad93de641e6aea27348f5578232b754419c8d2b27d4dfa0705df1d6`가 acceptance의 참조와 일치한다.
- 같은 디렉터리의 `durable-evidence-comparison.json`: 실제 로컬 `result.json/events.jsonl`과 서버 저장 JSON의 정확 비교 7/7, 모든 마지막 이벤트 `run.finished`, `cleanupErrors=[]`를 기록했다. SHA `0654dbed508a4eef07e2472d307766e89eb1ed79437ded374f8d5b3f71216aae`가 acceptance의 참조와 일치한다.

취소 실행 `run_dcf5e237-8fc4-4128-8b07-d87a13ac9a95`는 assertion 시작 뒤 취소 요청 당시 claimed였고, 후속 결과 cancelled·cleanup confirmed·evidence verified와 terminal을 확인했다. durable 이벤트 12개 및 result가 서버 저장본과 정확히 일치하며 불필요한 settlement 진단은 없다. 이는 정상 취소 인수이고, 의도적으로 실패한 observer나 실제 cleanup 실패도 진단 없이 처리한다는 뜻은 아니다. Agent exit 0은 전송 업무 완료이며 QA 결과 cancelled와 구분된다.

관리자는 별도로 SQLite의 Run 7개/artifact 6개/lease 4개 및 배포 파일 1904개를 확인했다고 전달했다. 이 관리 검토와 앱 배포 인수는 본 담당자의 위 파일 읽기 검토와 구분한다. 로컬 Windows Chromium/HTTP/Agent 및 제어 clock 예약 범위이며 다른 물리 PC·원격 production·실제 모바일 인수나 전역 프로세스 누수 보장을 포함하지 않는다. Engine 고정 payload와 Checker 제품 파일은 변경하지 않았고 locator apply는 계속 보류한다.
