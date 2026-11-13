# Design

## Context

기준은 main ecdb8ff와 기존 미커밋 alpha.6 구현이며 frozen alpha.6 tgz SHA256 `33dbcacea025fb98a52fb0411af05cb113bc85e47e84a98463912b6aace1acef`는 변경하지 않는다. 최신 사용자 범위가 config.yaml의 역사적 P1 설명보다 우선한다. 동기는 proposal의 Why를 따른다.

확인된 근거:

| 경계 | alpha.6 실제 관측 | 재현 근거 |
|---|---|---|
| CLI 입력 | validate의 추가 positional/--once/충돌 flag가 exit 0 | artifacts/service-hardening/reproduction-alpha6.json |
| 출력 | Windows 256노드 JSONL 미소비 시 timeout1500ms/cancel 모두 12초 watchdog kill, result 없음; 정상소비는 약1834ms passed | artifacts/service-audit-20261107/backpressure-256-baseline.json |
| 큰 graph | 1000노드 실행 후 result 노드 배열 maxItems256 때문에 INVALID_DOCUMENT/result 없음 | 성능 감사 backpressure-probe.mjs drain |
| Web 값 | Loading→350ms 후 Ready, assertText1500ms가 약40.6ms에 즉시 실패 | 관리자의 실제 Chromium 독립 probe |
| 세션 소유 | 같은 Playwright adapter 두 번 시작 후 첫 browser가 남음 | service-hardening/reproduction-alpha6.json; probe에서 직접 정리 |
| Appium 취소 | POST 후 cancel30ms, 서버300ms 후 생성: cancelled/cleanupErrors[]/DELETE0/원격 session 잔존 | service-audit-20261107/appium-session-cancel-baseline.json |
| Agent 저장 | 정상 closed/ACK 이력도 누적돼 한도에 도달; 축소128entry 실측 6번째 작업 중 실패 | service-audit-20261107/store-retention-probe 결과 |

## Goals / Non-Goals

**Goals:** 기존 선언형 실행의 의미와 독립 package를 유지하면서 서비스 프로세스 수명·결과 보존·진단 일관성을 개선한다. 실제 Windows pipe, 로컬 Chromium, Appium HTTP protocol fixture와 별도 npm 소비를 구분해 인수한다.

**Non-Goals:** 플랫폼 추가, 서버 DTO/Agent HTTP 변경, 사용자 script 실행, TS 전면 전환, 실제 모바일 기기 인수 주장, 무제한 실행/저장 수명 보장.

## Decisions

### 1. 명령별 입력 표와 lazy dispatch

args는 공통 parse 후 command별 positional 및 flag allowlist를 검사한다. preset subcommand/id처럼 기존 공개 위치는 유지하며 --version/--help 우선순위도 명시적으로 검사한다. JSON 기본 진단과 --diagnostics stderr, exit 0/1/2/3/4/5 계약은 유지한다. 무시되던 잘못된 인자가 거부되는 점은 release note에 적는다.

aqa 진입점에서 commands/execution의 정적 import를 제거한다. version/help는 가벼운 metadata/help만 필요하고 실행 명령에서만 adapter를 import한다. AJV/Playwright import 자체 비용과 browser 실행 비용을 섞지 않는다. 성능 목표는 같은 머신 5회 이상 cold median 개선이며 절대 시간 SLA로 과장하지 않는다.

### 2. Windows 출력 격리

Windows Node pipe stdout write는 동기적으로 실행 thread를 막을 수 있으므로 main thread에서 Promise.race만 추가하는 안은 배제한다. 작은 전용 writer child가 상속 stdout/stderr를 소유하고 부모는 bounded IPC request/ACK만 주고받는다. 부모는 실행과 control-stdin/timeout을 계속 처리한다. writer는 QA를 실행하지 않는다.

각 stdout/stderr channel은 독립 writer를 지연 생성하고 IPC 한 건씩 전송한다. message는 최대 8MiB, ACK 대기는 2000ms로 제한한다. 병행 요청은 고정 상한으로 거부하며 무제한 버퍼를 만들지 않는다. timeout/닫힘/자식 종료는 해당 channel 출력 실패를 고정하고 소유 writer PID만 종료한다. 실패 이후 같은 channel replay/diagnostic은 즉시 실패하며 다른 channel의 진단은 여전히 가능하다. 정상 종료에서는 ACK 완료 후 writer 종료를 기다리되 유한 기한을 둔다. stderr도 같은 경계로 보호한다.

onEvent 자체 reject 또는 출력 ACK2초 실패면 infra_error를 기록하고 terminal 이후 실패면 이미 작성된 outcome을 변경하지 않는다. 관리 승인 alpha7 의미 보정: 내부 run deadline이 callback 대기에서 소진된 경우 TIMEOUT/run → failed로 보존한다. bounded의 내부 timeout을 비공개 표식으로 구분하여 consumer가 던진 TIMEOUT 및 floor 잔여시간을 wallclock 재검사하는 비결정 분류와 혼동하지 않는다. never-resolving observer도 run budget 소진이면 TIMEOUT이다. 기존 failure 정착과 cancel 우선은 유지한다. CLI 전달 실패 exit3은 durable 결과와 다를 수 있다. 기본 1500ms run + evidence3s + cleanup5s + terminal1s 경계를 고려해 stalled probe watchdog12s로 실제 종료를 검증한다. helper와 browser가 남지 않았음을 직접 소유 PID로 확인한다.

### 3. 결과 계약과 수집 예산

| 항목 | alpha.6 | alpha.7 제안 | 호환 영향 |
|---|---|---|---|
| Flow nodes / edges | 1000 / 2000 | 유지 | 입력 호환 |
| result visitedNodes / unvisitedNodes | 각256 | 각1000 | 새 결과를 구 validator가 거부할 수 있어 draft.2 + 소비 pin 필요 |
| event/result/evidence artifacts | 256 | 유지 | Agent HTTP 256도 유지 |
| result cleanupErrors | 256 | 유지 + bounded 집약 | CLEANUP_ERROR 존재는 보존 |
| schemaVersion/모든 action/events | v1/기존 | 유지 | 신규 DSL 없음 |

수집 직전 남은 artifact 슬롯을 확인한다. screenshot은 1개, check report는 images수+1개를 예약하여 중간에 상한을 넘어 부분적인 공개 manifest를 만들지 않는다. 실행에서 요청한 수집의 초과는 sanitized ENGINE_ERROR로 실패시킨다. 실패 처리용 자동 evidence가 한도에 닿으면 추가 수집하지 않고 원래 failure를 유지한다. 이미 확정된 immutable bytes/hash를 변경하지 않는다.

cleanup 오류는 첫 오류를 보존하며 마지막 슬롯을 생략 수 집약에 사용한다. CLEANUP_ERROR는 별도 우선 보존하여 Agent의 unknown 판정을 막지 않는다. 1000노드/998개 optional screenshot 실패 및 마지막 session cleanup 실패를 회귀한다. schema validation은 최종 내구 기록 전에 유지하며 한도 불일치를 숨기는 catch-all success는 금지한다.

### 4. 값 단언 및 session

assertText/assertValue는 최초 가시성, 재관측, 일치 검사를 하나의 monotonic deadline으로 묶는다. 기대값은 secretRef/captured/literal 기존 해석을 사용한다. polling 간격은 약50ms이며 잔여 예산을 넘겨 sleep/request하지 않는다. mismatch만 기다리고 ambiguous selector·policy·transport·crash 등 fatal 오류는 즉시 전달한다. run/node cancel을 관측하고 오류에 actual/expected 값을 포함하지 않는다. node retry가 polling deadline을 새로 만들지 않도록 기존 ctx budget에서 계산한다.

Playwright adapter는 one-shot start guard로 기존 browser 소유권을 유지한다. Appium은 session 생성 요청을 보낸 상태와 session ID 확인/DELETE 확인을 구분한다. 요청 후 ID를 잃거나 삭제 미확증이면 endSession이 CLEANUP_ERROR를 만든다. 서버가 생성하지 않았을 수도 있지만 unknown이 맞으며 Agent에서 재배정하지 않는다. 아직 요청을 보내지 않은 config 검증 실패까지 unknown으로 확대하지 않는다.

### 5. 측정 기반 성능 개선

baseline compile warm median은 10/100/500/1000노드 약1.88/9.91/54.21/102.97ms, CLI cold version은 약700ms다. 관리 검토에 따라 현재 compiler는 유지하고 cold import와 출력 정체를 우선 처리한다. runner successor/visited lookup만 작은 Map/Set으로 개선하며 순서/hash/definite assignment 회귀를 통과해야 한다. validator 제거 또는 새 캐시/전역 mutable plan은 도입하지 않는다.

### 6. Agent checkpoint 관리 승인 설계

기존 empty204 retire에 더해 key별 latest set 값을 모두 재기록한다. claim/lease/historical/receipt/released/tombstone 키를 삭제하지 않는다. queue는 ackHighWater와 nextSequence를 entries 배열 길이에서 분리하고, 내구 ACK된 payload만 queue-base(scope, ack, next=ack)로 바꾼 뒤 pending delivery를 원래 순서로 기록한다. active/unknown 상태 자체와 미확정 전송은 그대로 남으며 압축으로 실행권 또는 완료 상태를 만들지 않는다. immutable body/evidence 파일은 삭제하지 않는다.

새 checkpoint journal은 version2로 기록하여 구 reader가 fail-closed하게 하고 새 reader는 v1을 읽는다. exclusive writer/fsync/atomic replace 및 기존 crash hooks를 유지한다. tombstone까지 무제한 저장할 수는 없으므로 status entries/bytes 한도와 AGENT_STATE_FULL exit3, 안전한 운영 중단·보관·새 identity 절차를 문서화한다. HTTP pin은 변경하지 않는다.

2026-11-07 관리 승인이 완료됐다. 구현 소유권은 성능 감사 담당의 packages/agent/store.mjs와 tests/agent-service-retention.test.mjs, tests/agent-store.test.mjs, tests/agent-checkpoint.test.mjs로 한정한다. Engine 담당은 이 네 파일을 편집하지 않고 통합 리뷰/전체 verify를 담당한다.

## Risks / Trade-offs

후보2 외부1000branch 소비에서 step.started 전달 직후 전체 run deadline을 넘으면 nodeDeadline 초기 검사가 TIMEOUT/step으로 분류하는 반례를 확인했다. node의 독립 deadline과 run deadline 중 실제 예산 출처를 추적한다. 내부 timer/예산 AbortSignal 또는 명시 만료 검사는 해당 출처의 phase를 사용하되 adapter가 예산 소진 전에 임의로 던진 QaError(TIMEOUT)는 그대로 보존한다. 외부 cancel은 우선하며 짧은 node deadline은 TIMEOUT/step이다. 후보2와 소비 실패 근거를 보존하고 후보3에서 회귀·전체 verify·영향 성능을 다시 확인한다.

- [writer 프로세스의 시작 비용] → 가벼운 helper, 지연 생성, cold 측정과 정상종료·상속 pipe 회귀. 실행만 분리하고 테스트 동작을 복제하지 않는다.
- [느린 출력 소비가 infra_error를 유발] → 2초의 명시 전달 예산과 디스크 결과 안내, 정상 소비의 기존 JSONL 계약 보존.
- [polling이 기존 즉시 실패보다 오래 걸림] → 단일 node 예산, 짧은 실패 fixture, actual/expected 비밀 보호.
- [구 validator가 큰 결과를 거부] → 새 draft/bundle/타입, alpha7 외부 소비와 Checker pin 게이트; alpha6 롤백 파일 보존.
- [Appium 취소 후 실제 세션을 찾을 수 없음] → unknown/quarantine과 운영자 확인 유지; mock protocol과 실기기 증거 구분.
- [Agent 기록 압축의 재실행 위험] → 상세 관리 검토 전 적용 금지, unresolved 보존/재시작/중간 crash 반례 필수.

## Migration Plan

명세 strict → 관리 검토 → 각 결함 회귀와 작은 구현 → 성능 담당 동일 측정 → 전체 verify → alpha7 후보 pack/독립 설치 API·CLI·Agent 소비 → 관리자 hash 확인 → Checker 소비 순서다. alpha6/release/candidate는 덮어쓰지 않는다. 후보 변경은 새 후보 디렉터리로 구분하며 최종 고정 전 package payload와 설치 파일 SHA를 대조한다.
