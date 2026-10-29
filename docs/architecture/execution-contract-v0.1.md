# Engine ↔ Checker 실행 계약

상태: contract 0.1.0-draft.1 / engine 0.1.0-alpha.2 local-preview. [JSON Schema](../../contracts/schemas/qa.schema.json)와 [manifest](../../contracts/manifest.json)가 현재 입력/출력 구조의 기준이다. 이 문서의 중앙 Agent/idempotency 정책은 P4 목표이며 로컬 CLI 구현 완료를 뜻하지 않는다.

## 버전과 배포

contractVersion은 계약 bundle의 SemVer(현재 prerelease), schemaVersion은 문서 종류+major(예: qa.flow/v1)다. 두 값을 혼용하지 않는다.
engineVersion은 0.1.0-alpha.2다. Checker의 기존 alpha.1 pin은 별도 관리 결정으로 갱신하며 Engine 산출물 생성만으로 자동 변경하지 않는다. 원격 release tag는 없고 GUI 통합 인수는 Checker 담당이다. ^0.1.0 같은 범위로 실행 바이너리를 선택하지 않는다.
각 교환 객체에는 schemaVersion이 필요하다. 해당 객체에 필요한 runId/attempt/idempotencyKey/sequence를 아래에서 지정한다. unknown major는 UNSUPPORTED_SCHEMA로 거부한다.

## 객체와 필수 의미

| schemaVersion | 핵심 필드/의미 |
| --- | --- |
| qa.flow/v1 | id, entryNode, nodes, edges; variables, metadata 선택 |
| qa.testcase/v1 | id, name, flowRef, expected, prerequisites, platforms; tags/priority |
| qa.suite/v1 | id, name, cases, execution.parallelism/stopOnFailure; 회사 일정/담당자 제외 |
| qa.selectors/v1 | id, selectors[alias][platform] = strategy/value |
| qa.target/v1 | id, platform, launchTargets(별칭→URL/appId), allowedOrigins/allowedAppIds |
| qa.runRequest/v1 | runId, idempotencyKey, target, execution, immutable snapshot manifest, secretRefs |
| qa.runEvent/v1 | runId, attempt, sequence, type, timestamp; nodeId/testCaseId/outcome/durationMs/artifacts |
| qa.result/v1 | runId, attempt, status, outcome, startedAt/finishedAt, executed, artifacts; failure |
| qa.capabilities/v1 | engineVersion, supportedSchemas, platforms, supportedActions, driverVersions, targets |
| qa.evidence/v1 | runId, attempt, artifacts(type/path/contentType/sha256/size) |

snapshot manifest는 TC/Flow/Suite/selector/target/environment와 app build의 version/hash를 포함한다. SHA-256은 실제 64자리 hex로 기록하고 placeholder hash를 실행 요청으로 받아들이지 않는다.
Flow/Blueprint snapshot hash는 key를 재귀적으로 정렬한 canonical JSON의 UTF-8 SHA-256이다. 배열 순서는 보존한다. 따라서 JSON/YAML/XML의 동일 정의는 같은 hash를 가진다. UI metadata까지 포함한 정확한 snapshot이며 artifact 파일 hash는 원본 bytes 기준이다.

## 원본 지침의 용어 충돌 정리

| 원본 초안의 차이 | 이번 초안의 규칙 |
| --- | --- |
| launch / launchApp / navigate | DSL canonical action은 launch. target manifest 별칭으로 URL/appId를 해석하고 adapter 내부 navigate/launchApp으로 매핑 |
| click/fill vs tap/input capability | 외부 supportedActions는 tap/input. click/fill은 Playwright 내부 API 명칭 |
| assertion code 소문자/대문자 | 외부 error code는 UPPER_SNAKE_CASE, outcome은 소문자 |
| 모든 객체에 실행 필드 포함 가능성 | schemaVersion은 모든 교환 객체; runId 등은 실행 envelope에만 |
| secretRef와 from/ref 예시 | Flow 변수는 {from: secret, ref: login.email}; RunRequest.secretRefs는 참조 목록. 값은 포함하지 않음 |
| engine 버전 범위 예시 | 호환성 범위와 배포 pin 구분; Checker 실행 artifact는 정확한 버전+hash |
| unrun 결과 enum | 엔진 outcome 아님. Checker가 occurrence/run 부재를 평가한 운영 표시 |

## 그래프와 변수

Node.type: start | action | assertion | branch | end. start 하나, entryNode는 start를 가리킨다. node.id는 유일하고 모든 노드가 도달 가능해야 한다.
P1은 cycle 없는 유한 DAG다. start/action/assertion은 outgoing edge 하나, end는 0개, branch는 label true/false 각각 하나다. branch condition은 allowlisted 비교 연산과 변수 참조만 허용하며 코드 eval은 금지한다.
재시도는 edge loop가 아니라 노드의 제한된 retry 정책이다. default maxRetries=0, 유한 timeoutMs와 run timeout이 필요하다. P1은 실패 노드에서 실행 중지, arbitrary onFailure jump는 후속 schema change다.
변수는 literal 또는 secret reference다. input.params.valueRef로 참조하고 실행 시 SecretResolver가 값을 공급한다. UI 위치는 metadata.presentation 아래에 두어 plan 해시의 실행 의미와 구분한다.
selector 전략은 플랫폼별 testId/accessibilityId/resourceId/role/text/css/XPath 후보를 adapter가 광고한다. 좌표/XPath가 항상 정확하다고 가정하지 않는다.

## 실행 요청·이벤트·결과

- runId는 논리 실행의 ID, attempt는 1부터 증가하는 명시적 재시도다. 단순 재전송은 attempt를 늘리지 않는다.
- idempotencyKey는 (projectId, key)로 유일하다. 동일 key+payload는 동일 run을 반환하고 다른 payload는 충돌이다. 실패 후 수동 재실행은 새 runId/key 또는 서버가 발급한 새 attempt다.
- event identity는 (runId, attempt, sequence); sequence는 각 attempt에서 1부터 단조 증가하며 재전송 시 유지한다.
- replay(fromSequence)는 해당 sequence **다음**부터 전송한다. 서버는 중복을 제거하고 gap을 감지해 replay를 요청한다. timestamps는 RFC3339 UTC, 정렬 기준은 sequence다.
- CLI는 run별 events.jsonl을 남기고 flush한다. remote durable outbox/replay/ack는 P4에서 구현한다.
- result와 artifacts는 terminal 이후 불변이다. artifact 경로는 run/attempt 아래 상대 경로이며 .., absolute path, symlink escape를 거부한다. sha256은 파일 bytes 기준이다.
- 정상 terminal result 하나만 수용한다. 중복 동일 terminal은 멱등 처리하고 상충 결과는 감사/조사 대상으로 거부한다.

| 상태 모델 | 값 |
| --- | --- |
| run status | queued, running, finished, cancelled |
| terminal outcome | passed, failed, skipped, blocked, infra_error, cancelled |
| 업무 progress (Checker) | todo, in_progress, in_review, completed, blocked |
| occurrence (Checker) | planned, enqueued, assigned, started, completed, missed |

queued/running에는 outcome을 확정하지 않는다. cancelled status는 cancelled outcome이다. finished에는 그 외 terminal outcome이 필요하다.
UNSUPPORTED_CAPABILITY는 blocked, ASSERTION_FAILED/ELEMENT_NOT_FOUND는 failed, DEVICE_UNAVAILABLE/SESSION_ERROR/ENGINE_ERROR/RUNNER_CRASH는 infra_error다. TIMEOUT은 assertion/action 실행이면 failed, session setup/runner 통신이면 infra_error로 단계 정보를 함께 기록한다.
UNSUPPORTED_SCHEMA/INVALID_FLOW/SECRET_NOT_FOUND는 실행 전 거부(blocked 진단)이며 성공 RunResult를 만들지 않는다.

## CLI 및 transport

구현 명령: aqa schema/template/import/validate/plan/run/run-suite/devices/doctor/demo. qa.blueprint/v1은 flow/selectors/target/testCase를 묶고 qa.plan/v1은 검증된 실행 계획을 나타낸다.
--json의 validate/devices/doctor는 단일 JSON object, run은 JSONL events이며 최종 event가 result 경로를 가리킨다. 진단은 stderr, 로그에 secret 값은 없다.
계획된 exit codes: 0 passed/정상 조회, 1 테스트 실패, 2 입력·schema 오류, 3 환경/engine 오류, 4 unsupported/blocked, 5 cancelled. Suite skipped만 있는 경우 성공으로 보고하지 않고 정책 사유를 포함한다.
Flutter는 shell command 문자열 대신 executable + argument array로 실행한다. child exit, 잘못된 JSONL, event gap, missing final result를 정상 완료로 취급하지 않는다.
Agent HTTP transport에서도 같은 의미를 유지한다. subscribe/cancel/result/health와 인증/lease token의 구체 HTTP 계약은 P4 change에서 확정한다.

## 보안과 호환 검증

Flow는 실행 가능한 자동화 정의다. action/target allowlist, production side-effect opt-in, secret scope, artifact 경로를 실행 전에 확인한다. Checker는 프로젝트 RBAC, Agent는 credential/lease scope를 검증한다.
로그 redaction만으로 screenshot의 비밀값이 사라지는 것은 아니다. screenshot mask/비활성화 정책과 artifact 접근권한·보존 기간을 적용한다.
P1 fixture와 P2 round-trip, unknown schema/unsupported action, missing secret, child crash, result hash, replay 중복, lease 충돌은 단계별 검증 대상이다.

