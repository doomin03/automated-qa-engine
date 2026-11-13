# alpha.10 Checker 소비 경계 읽기 검토

2026-11-12. Engine 담당의 읽기 검토이며 Checker 제품 수정·서버 실행·Flutter 검증을 수행하지 않았다. Engine Git root는 `C:/workspace/QA/automated-qa-engine`, main HEAD는 `8dd206a24657324c5675f4bb092d69c6ba366e7f`다. 기존 alpha.9/alpha.10 dirty 작업과 고정 아카이브를 보존했다. 아래 Checker 경로는 `C:/workspace/QA/automated-qa-checker` 기준이다. 통합 작업 중 파일은 이후 바뀔 수 있으므로 이 문서는 조회 시점의 경계와 필요한 인수를 기록한다.

## 결론

alpha.10 공개 실행/작성/Agent schema bytes는 alpha.9와 같다. 이것만으로 서버의 exact runtime pin이나 기존 Agent 등록이 호환 판정을 통과한다는 뜻은 아니다. 신규 실행, 기존 기록 조회, 등록된 worker, 게시된 버전의 pin을 각각 인수해야 한다. 새로운 실행 schema 또는 source/provider 판정 우회는 필요하지 않다.

고정 아카이브/전체 설치 파일과 실제 API·CLI 검증은 [통합 인계](alpha10-integration-handoff.md), [alpha.10 검증](../validation-alpha.10.md)에 있다. 이 검토는 해당 패키지 인수를 반복하거나 Checker 통합 성공을 대신하지 않는다.

## 정확한 변경·검증 지점

| 경계 | 실제 파일·symbol | 확인 사항 및 통합 시 처리 |
| --- | --- | --- |
| 서버 설치 pin | `packages/contract/engine-runtime.json`, `scripts/install-engine-runtime.mjs` | 조회 시 alpha.6. archive SHA 확인 후 `.local/engine`에 설치하고 `apps/app/assets/engine-runtime.json`의 파일 manifest를 만든다. Desktop 전용 설치와 별도다. 검증된 alpha.10 아카이브와 새 manifest를 한 쌍으로 사용한다. |
| 서버 공개 bundle | `scripts/import-engine-contract.mjs`, `scripts/check-engine-dependency.mjs` | import는 bundle/release SHA·runtime·파일명·owner를 확인하고 `generated/engine-contract.json`, `engine-dependency.json`을 쓴다. installer는 generated bundle을 app의 legacy `engine-contract.json`으로 복사하므로 import와 설치의 순서를 맞춘다. dependency metadata의 `runtimeIntegrationEnabled:false`/usage는 과거 설명이어서 현재 역할과 구분해 검토한다. |
| 실제 서버 runtime | `apps/server/src/modules/platform/platform.config.ts:platformConfig`, `engine-contract.service.ts:EngineContractService.start/verifyIntegrity/plan` | `QA_ENGINE_CLI`, `QA_ENGINE_MANIFEST` 절대 경로를 명시한다. CLI와 packageRoot, 모든 manifest 파일 SHA, `--version`, runtime별 release bundle, 공개 schema를 읽는다. 서비스가 실제 시작한 version/hash를 HTTP context로 확인한다. local/test 인증·loopback 조건을 완화하지 않는다. |
| Desktop 설치 | `apps/app/engine-runtime-pin.json`, `scripts/install-desktop-engine.mjs`, `scripts/lib/authoring-artifact.mjs` | Desktop 전용 manifest/bundle/installation receipt가 별도다. 최신 helper는 `contracts/authoring-release.json.artifact`를 읽고 상대 경로/realpath containment 및 pin·metadata·manifest SHA를 모두 비교한다. alpha.10의 runtime 포함 authoring filename과 alpha.9 구형 filename을 metadata로 처리한다. |
| Agent 등록 | `apps/server/src/modules/agent/agent.service.ts:provision/claim` | provision이 등록 당시 engine version/contract version/bundle hash를 DB에 저장한다. claim은 요청 triple을 그 등록값과 비교한다. 새 서버 파일만 설치해도 기존 등록은 자동 변경되지 않는다. 새 검증용 Agent identity·state·provision으로 인수하고 기존 token/lease/history를 덮어쓰지 않는다. |
| Agent 업무·게시 pin | `agent.service.ts:preparePublished/compatible/queuePrepared/lease/claim` | 게시 Blueprint와 Suite child의 runtime을 검사하고 job/lease에 pin을 보존한다. 현재 서버와 다른 queued job은 `engine_pin_incompatible`로 차단된다. 기존 게시물·Suite hash를 재작성하여 통과시키지 않는다. 새 runtime용 게시 revision과 Suite pin 또는 차단 UX를 명시 검증한다. |
| 신규 Run | `apps/server/src/modules/platform/platform.service.ts:createRun` | 요청 engineVersion이 현재 서비스 version과 같고 새 plan의 version/snapshot도 일치해야 한다. alpha.6 클라이언트가 alpha.10 서버에 신규 Run을 보고하면 자동 호환 처리하지 않는다. 거부는 의도된 exact pin 경계다. |
| 기존 Run·늦은 결과 | `platform.service.ts:getRun/acceptResult/reconcile` | getRun은 DB의 원래 engine_version과 result_json을 반환한다. acceptResult는 현재 로드된 schema로 검증한 뒤 저장된 Run의 version/identity/outcome과 비교한다. 기존 기록 조회와 기존 미완료 Run의 늦은 result 수신은 별도 테스트하며 version을 현재 값으로 다시 쓰지 않는다. |
| Agent 역사 증거 | `agent.service.ts:historicalEvidence` | 원래 저장한 plan의 version/snapshot/run identity를 비교한다. 역사 자료 전송을 새로운 실행권한이나 재배정 근거로 바꾸지 않는다. |
| 합성 sourceMap | `apps/app/lib/features/xml_blocks/repositories/document_authoring_repository.dart:compose` | authored snapshot 두 개와 sourceMap hash, 비시작/비종료 노드의 정확 집합, asset/instance/raw source hash/sourceNodeId를 검증한다. 원본 authored sourceMap을 유지하고 `uiSourceMap`에만 sourceFile을 더한다. alpha.10 전환으로 namespace·sourceMap을 재생성하거나 검사를 제거할 이유가 없다. |

`run_view_model.dart`의 bounded authoring expansion sourceMap은 nodes 목록 기반 별도 계약이다. 합성 sourceMap.nodes 매핑과 혼용하지 않는다. 합성 후 명시 실행 결과와 서버 게시 여부도 독립 상태로 유지한다.

## 테스트와 예제의 누락 위험

- `apps/server/test/agent.test.mjs`는 기본 `.local/engine`/legacy manifest를 사용하고 실제 서비스의 pin을 fixture lease에 대입한다. 이것은 최신 runtime 인수에 적합하지만 구 pin 거부 검사를 대신하지 않는다. 기존 old-worker/new-worker pin mismatch 테스트를 유지한다.
- `platform.test.mjs`, `product-context.test.mjs`, `scheduler.test.mjs`, `suite.test.mjs`, `workflow.test.mjs`, `auth.test.mjs`, `administration.test.mjs`도 같은 legacy 설치 경로를 소비한다. 새 manifest와 실행 파일이 함께 바뀌었는지 확인한다. scheduler의 old-engine/wrong-hash 거부 회귀는 보존한다.
- `apps/server/test/fixtures/administration-alpha6-run`과 alpha6 check report는 실제 역사 증거다. 버전 문자열 전체 치환 대상이 아니다. 새 서비스에서 기존 기록이 그대로 보이는 인수에 사용하고 신규 run fixture와 분리한다.
- `apps/server/scripts/agent-demo.mjs`는 `.local/engine`과 legacy manifest가 기본이다. 이미 존재하는 agent-demo 등록은 재provision하지 않는다. 새 테스트 DB/identity/state를 사용하지 않으면 구 pin이 남을 수 있다.
- `agent-demo-admin.mjs`의 기본값은 `.local/engine-agent-candidate`로 demo와 다르다. 양쪽에 동일한 `QA_ENGINE_CLI`/`QA_ENGINE_MANIFEST`를 명시해야 한다. `agent-schedule-demo.mjs`는 이 환경변수를 직접 요구한다.
- `apps/server/scripts/prepare-agent-candidate.mjs`는 alpha.6 후보 두 개의 SHA/경로/runtime/bundle명을 하드코딩한 역사 도구다. alpha.10 일반 설치 도구로 사용할 수 없다. 기존 증거는 보존하고 새로운 명시 인수 경로를 사용한다.
- `README.md` 조회 시 Desktop alpha.8 / 서버 alpha.6 설명이 남아 있었다. 통합 완료 후 실제 default pin·설치경로·새 기기 인수 한계와 맞추되 이전 검증 기록을 현재 실행 증거로 바꾸지 않는다.

## 통합 인수에 남길 증거

1. Desktop와 서버 설치 각각 archive SHA, 설치된 모든 파일 SHA, execution/authoring bundle SHA, 실제 CLI version을 확인한다. authoring metadata helper의 구·신 filename 및 경로 거부 회귀를 유지한다.
2. 새 서버와 새 worker identity/state로 실제 claim→실행→events/result/artifacts→receipt를 인수한다. PASS/의도 FAIL/cancel을 구분하고 alpha.10의 정상 취소 callback terminal/불필요한 settlement 진단 제거를 확인한다. 진짜 callback/cleanup 실패를 성공으로 숨기지 않는다.
3. 구 runtime 신규 Run 거부와 구 Run 조회·증거 보존을 함께 검사한다. 늦은 구 result가 허용되는 경우 저장된 identity/version 검사가 유지되는지도 검사한다.
4. 앱 source/provider 검사를 유지한 상태에서 compose→sourceMap→XML/plan→명시 실행→선택적 서버 게시를 확인한다. 실제 Release·다른 PC readiness 인수는 담당자의 별도 결과를 따른다.

이번 검토에는 실제 서버 재시작, 사용자 DB·Agent state migration, 패키지 재생성, Checker 코드 수정이 없다. 인수 결과가 오기 전 alpha.10 통합 승격이나 locator alpha.11 구현을 완료로 보고하지 않는다.
