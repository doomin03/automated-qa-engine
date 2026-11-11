# Design

## Context

alpha.5는 독립 package API/CLI와 stdin 취소, durable events/result, 단일·순차 Suite 실행을 제공한다. core가 runId를 생성하고 attempt=1을 사용하며 Suite는 각 case에 새 runId를 만든다. 서버 할당 ID를 이 값에 강제로 넣으면 기존 소비 의미가 바뀐다. Agent transport는 이 core 밖에 두고 원본 실행 identity를 보존한다. 동기는 proposal.md를 따른다.

## Goals / Non-Goals

**Goals:** Desktop과 독립된 명시 실행 프로세스, 고정 계약 소비, 운영자 정책 준수, 중복 재실행을 피하는 내구성 복구, 종료 불명 기기 격리.

**Non-Goals:** core에 서버 의존 추가, OS 서비스 자동 설치, 임의 원격 shell/실행파일·Appium URL 수신, 운영자 인증 정보의 서버 업로드, 작업 재시도 자체를 Engine run attempt로 합성, 실제 기기 없는 모바일 인수 완료 주장.

## Decisions

### 패키지와 계약 소유

동일 npm package에 optional `aqa agent --config FILE` 명령을 추가하고 packages/agent의 config/transport/store/supervisor를 분리한다. 독립 aqa-agent package는 설치·버전 조합 수를 늘리므로 첫 단위에서 사용하지 않는다. core 공개 import에는 Agent 모듈을 연결하지 않는다. runtime은 alpha.6 신규 배포이고 alpha.5 tgz는 불변이다. 실행 계약 0.3.0-draft.1과 agentProtocolVersion 0.1.0-draft.1을 별도 식별한다.

HTTP Agent 업무 DTO/auth/lease/queue/reconcile schema는 Checker 정본이다. Checker가 versioned artifact+SHA-256+fixture를 발행하면 Engine이 vendor한 고정 artifact로 검증한다. Engine은 실행 Blueprint/plan/event/result 정본을 계속 소유한다. 같은 이름의 독자 실행 schema나 HTTP DTO를 두 저장소에서 따로 발명하지 않는다. exact HTTP schema pin 전에는 transport apply를 시작하지 않는다.

2026-10-31 관리 승인 pin은 Checker packages/contract/agent-protocol/v0.1.0-draft.1/openapi.json, SHA 754b35b51db3c75584d1d01343cdcecfa5c2c27674f86b60fac54a53d356f9de다. Engine contracts/agent-protocol/pin.json과 버전 디렉터리에 bytes 그대로 보관한다. 앞선 b0156a/7797/f3cf 초안은 superseded다. executionPolicy.allowProduction과 로컬 allowProduction은 둘 다 true일 때만 production을 허용하며 누락은 false다. 9개 operation(claim/heartbeat/events/complete/reconcile/resource GET/artifact PUT/historical evidence/instance release)을 제공하며 opaque Engine JSON 문자열을 감싸는 형태다. 최초 실제 수직 인수는 caseCount=1로 한다. ordered Suite는 원래 목표에 남고 별도 후속 task로 검증하기 전 완료로 표시하지 않는다.

### 신원과 실행 identity

Agent 전용 credential은 사용자 Desktop 세션과 다르고 프로젝트/agent/resource scope가 제한된다. config는 서버 base URL과 token env reference, durable state root, 실행 정책을 담는다. 로컬 project/credential/secretRef allowlist는 기본 빈 목록이며 서버 배정만으로 host의 모든 환경 비밀값에 접근할 수 없다. token 원문을 로그/Blueprint/outbox에 저장하지 않는다. HTTPS를 기본으로 하고 명시 local-test loopback HTTP만 허용한다. 리다이렉트 및 외부 응답의 arbitrary download URL은 거부한다.

서버 executionId/job attempt/leaseId/fence는 배정 identity다. Engine `(runId,attempt,sequence)`는 실행 identity다. 전달 envelope의 lease 단위 deliverySequence와 caseId가 둘을 연결한다. event 원문은 변경하지 않는다. Suite의 case별 runId를 서버 단일 runId로 바꾸지 않는다. 서버 ack는 deliverySequence 연속 prefix이며 같은 identity+동일 bytes 재전송은 멱등, 다른 bytes는 conflict다.

claim 요청은 durable claimRequestId를 사용한다. HTTP 응답이 유실된 뒤 같은 요청을 반복해도 새 작업을 두 번 받지 않는다. reconcile은 Agent 로컬 기록뿐 아니라 서버가 해당 Agent에 보유한 unknown active lease도 반환하여 유실 claim을 확인한다. exact endpoint/payload는 Checker 초안 합의 및 고정 artifact를 따른다.

### 배정 자료와 로컬 허용 정책

서버 job은 immutable ordered cases로 정규화한다. 각 case는 caseId, 완전한 expanded Blueprint, blueprintSnapshotHash, resource manifest를 갖는다. 단일 Blueprint도 한 case다. Suite order/stopOnFailure는 서버가 고정한 입력의 일부다. authoring 원본/sourceMap은 조회 증거이며 실행은 이미 확장된 snapshot을 사용한다.

Agent는 자기 private job 디렉터리에 files를 exclusive write하고 schema/compile/hash를 다시 확인한다. 자산은 manifest의 상대 path/hash/size/content type을 확인하고 bounded read/총량 제한 후 저장한다. 절대경로·상위탈출·symlink·중복 파일/논리 충돌은 거부한다. 서버가 보낸 임의 TC.flowRef를 host filesystem에서 읽지 않는다. 필요한 모든 문서/자산은 pinned materialization 내부에 있어야 한다.

로컬 운영자가 지정한 exact web origins, native app IDs, canonical resourceKey→device/Appium config mapping, platform/action 범위, production opt-in과 서버 승인 scope의 **교집합**만 실행한다. 서버의 신뢰된 배정이어도 운영자가 허용하지 않은 target은 시작하지 않는다. Blueprint origin 목록 전체와 launch target을 검사하여 추가 network scope가 숨지 않게 한다. native endpoint/udid/secret resolver는 로컬 config에서만 해석한다. reference path 역시 materialized root를 벗어나지 않는다.

Agent의 Appium 시작 capabilities는 platformName, appium:automationName/udid/deviceName/appPackage/appActivity/bundleId/newCommandTimeout/noReset/autoLaunch/appWaitPackage/appWaitActivity/appWaitDuration만 허용한다. unsupported launch override/설치 capability는 session POST 전에 blocked로 거부한다. autoLaunch=false는 거부하고 appWaitPackage/Activity는 허용 앱 확장이 아닌 시작 대상과 동일한 대기 조건만 허용한다. noReset/autoLaunch가 있다면 boolean, appWaitDuration은 1..300000ms다. 누락된 선택 capability를 Agent가 임의 추가하지 않으며 기존 adapter의 newCommandTimeout 기본60초와 플랫폼별 automationName 검증은 유지한다. 이 whitelist는 Agent 전용이며 직접 CLI/API의 기존 Appium config 계약은 바꾸지 않는다.

### Child 실행과 lease

첫 단위는 Agent 한 프로세스당 active lease 하나다. 매 시작마다 instanceId를 만들고 claim/heartbeat/reconcile을 agentId+instanceId에 결합한다. 동일 state root에는 단일 writer lock을 두며 lock owner process identity를 확인한다. stale lock은 이전 프로세스 부재를 확인한 경우에만 제거하고 PID 재사용/확인 불가 상태는 자동 탈취하지 않는다. canonical resourceKey의 전역 배타 lease는 서버 transaction이 보장한다. 서로 다른 Agent가 같은 physical device를 다른 alias로 등록하는 운영 오류는 등록 단계에서 canonical identity 검토가 필요하다.

같은 Agent credential로 다른 state root/머신에서 시작한 두 instance는 local lock만으로 막을 수 없으므로 서버도 active instance ownership을 검증한다. 같은 outstanding lease/claimRequestId를 다른 instance에 실행 권한으로 반환하지 않는다. 새 instance는 reconcile-only로 기존 실행 종료 여부를 확인하고 미확정이면 quarantine한다. 전송 복구용 조회와 재실행 허가를 구분한다.

claim 성공 후 실행 intent/state를 durable 기록하고 설치된 동일 runtime CLI를 shell 없이 child process로 시작한다. case는 기존 CLI `run --json --diagnostics stderr --control-stdin`로 순차 실행하며 document/reference root는 해당 materialized 디렉터리다. Suite 중단 정책과 cancel 뒤 다음 case 금지를 지킨다. 경로/args는 서버 arbitrary command로 조립하지 않는다.

관리·양측 합의 TTL은 30초, heartbeat 5초, HTTP timeout 5초, 안전 여유 5초다. 요청 시작 monotonic time에 서버가 알려준 유효기간을 더해 보수적으로 lease budget을 계산하여 응답 왕복 지연을 허용시간에 더하지 않고 wall clock 변경에 의존하지 않는다. fence 거부/명시 cancel/안전 cutoff까지 heartbeat 불가 시 child stdin cancel을 보낸다. 재전송 이벤트의 ack가 heartbeat 성공을 대신하지 않는다. exact 시간 필드는 Checker schema에 고정한다.

취소 후 기존 runner의 증거/cleanup 예산을 수용한 유한 종료 시간을 둔다. child가 종료하지 않으면 직접 소유한 child에 한하여 강제 종료를 시도하되 종료/외부 session 정리 성공을 합성하지 않는다. 정상 child 종료, 일치하는 durable terminal/result, cleanup 확증이 없으면 resource를 quarantine하고 새 job을 시작하지 않는다. native session 생성 응답 유실도 종료를 확증할 수 없는 상태다. lease 만료만으로 서버가 같은 물리 device를 재배정하지 않는다.

### Outbox와 restart reconcile

event/result/artifact upload intent는 서버 전송 전에 durable 저장하고 ack 이후 연속 cursor를 atomic 교체한다. JSONL 원본/sha와 deliverySequence를 함께 보존한다. 서버 timeout/중복 ack는 실행을 다시 시작할 사유가 아니다. outbox 용량/총 event bytes를 제한하고 꽉 차거나 디스크 쓰기 실패하면 실행을 취소·정리하며 수집 성공을 보고하지 않는다.

Agent 재시작은 새 claim보다 먼저 local state와 서버 reconcile을 수행한다. 이미 실행 intent가 있는 job을 자동 재실행하지 않는다. 재개란 전송/outbox 복구이며 browser action 재개가 아니다. 정상 종료 증거가 있으면 pending events/result/artifact만 replay하고, child/session 생존이 불명이면 quarantine한다. PID 재사용 때문에 숫자 PID만으로 다른 프로세스를 종료하지 않는다. manual release는 운영자가 실제 종료를 확인한 뒤 서버와 로컬 양쪽의 기록을 일치시켜야 한다.

complete는 각 case의 실제 result와 별도의 executionStatus/cleanupState를 제출한다. preflight 거부나 child crash로 Engine result가 없는 경우 업무 실패 상태로 기록하고 가짜 Engine terminal/result를 만들지 않는다. artifact manifest upload 실패는 테스트 outcome과 별개 전송 상태이며 동일 result를 재사용한다. 서버는 stale fence로 결과를 현재 실행에 반영하지 않지만 reconcile용 과거 증거 접수 정책은 명시 계약으로 구분한다.

자료 다운로드는 서버가 발행한 opaque resourceId와 pinned name/hash/size를 통해서만 한다. arbitrary URL은 받지 않는다. complete는 실제 cleanup 확인과 artifact bytes 검증이 끝나면 completionReceipt/deliveryClosed를 반환한다. 그 전에는 reporting heartbeat를 유지한다. 모든 완료 receipt를 durable ack한 뒤에만 instance-release를 요청한다. expired/quarantined의 historical-evidence는 실행권·TTL·resource lock·instance 소유권을 변경하지 않으며 executionPermission/resourceReleased는 false다.

완료 응답 유실은 reconcile의 immutable completionReceipt/deliveryClosed/evidenceStatus와 lease.acceptedThrough로 복구한다. closed decision은 전송 조회만 허용하고 실행을 재개하지 않는다. instance-release는 reportingInstanceId와 ownerInstanceId를 분리하며 ownerStopped=true를 요구한다. self-owner의 정상 종료에서는 claim/execution supervisor 중단과 모든 child 종료를 확증하고 ACK 수신용 reporter는 살아 있다. restart된 oldowner에서는 추가로 이전 OS process 부재를 확인한다. 서버는 이 boolean만 신뢰하지 않고 모든 owner lease의 closed/cleanupconfirmed/evidenceverified/receipt ack를 독립 확인하고 owner instance를 영구 retired 처리한다.

### 빈 queue 대기의 bounded checkpoint

빈 claim도 intent와 204 결정을 기록하므로 단순 append만 하면 20,000 records 한도에서 유휴 Agent가 약 2시간 47분 뒤 종료될 수 있다. 관리 검토에서 이를 장시간 예약 Agent 결함으로 판정하여 confirmed HTTP 204의 완료 claim만 retire하는 checkpoint를 추가한다. unknown/pending claim, 받은 lease, 실행 intent, 모든 event/ACK/history/receipt 및 그 중간 journal operation은 그대로 보존한다. immutable evidence 파일은 삭제하지 않는다.

동일 single-writer lock과 직렬 write queue 아래에서 마지막 상태가 정확한 empty 결정인 claimRequestId 집합만 고른다. 해당 claim key의 requested/empty set operation만 제외한 나머지 journal operations를 순서대로 보존하며 새 hash chain/물리 sequence를 만든다. durable event sequence/ACK/실행 identity는 바꾸지 않는다. 128개 confirmed empty claims마다 또는 journal 여유 부족 전에 checkpoint를 고려하고, reclaim할 empty claim이 없으면 기존 한도/명시 오류를 유지한다.

새 journal을 exclusive temporary file에 bounded write 후 fsync하고 기존 descriptor를 닫은 뒤 같은 디렉터리에서 atomic rename/replace한다. replace 전 crash는 원래 journal, replace 후 crash는 완전한 새 journal로 복구해야 한다. rename 실패나 reopen 실패는 writer를 poisoned 상태로 종료하며 다음 시작에서 권위 파일 journal.jsonl만 읽는다. tmp 잔여를 실행 intent나 최신 파일로 추정하지 않는다. OS/filesystem의 전원 장애 내구성 한계를 별도 명시하며 active 자료를 지워 예산을 회피하지 않는다.

빈 claim 뒤 강제 종료된 owner도 서버 instance ownership을 보유할 수 있다. 첫 네트워크 요청 전에 instanceId/ownerPid를 durable 기록한다. 재시작 후 모든 reconcile 페이지에서 outstanding lease가 없고 로컬에도 대응되지 않는 미확정 lease가 없을 때만, 이전 OS process 부재를 확인하고 oldowner의 empty receipt release를 요청한다. 서버는 독립 transaction 검증 후 owner를 retired 처리한다. pending/unknown claim은 먼저 서버의 전체 조회를 거치며 조회가 active/unknown lease를 반환하면 empty release를 금지한다. 반대로 로컬 미확정 lease가 있는데 서버가 이를 누락해도 새 claim을 시작하지 않는다. closed/cleanupconfirmed/receiptack/released까지 양쪽 확인한 이력만 누락 예외로 인정한다.

### 명시적 운영자 복구

2026-10-31 관리 승인으로 HTTP artifact는 SHA 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490으로 증분한다. candidate-1의 754b35 계약/증거는 보존하고 candidate-2 이후에 적용한다. Lease.state에 recovered를 추가하며 ReconcileDecision.operatorRecovery는 required nullable `{id,confirmedAt,priorFence,newFence}`다. OpenAPI allOf(ref)+nullable는 내부 Ajv에서 null 또는 해당 object로 정확히 해석한다. date-time과 priorFence=기존 lease fence, newFence>priorFence를 검증한다.

관리자가 expired/quarantined resource의 실제 process/session 종료를 확인하고 사유·idempotency를 남긴 경우 서버가 recovered와 fence 증분을 발행한다. Agent는 이전 OS process 부재, 모든 reconcile 페이지, 기존 immutable lease identity를 대조하고 local phase만 recovered로 기록한다. 원래 result/outcome/cleanup을 passed/confirmed로 바꾸거나 completionReceipt를 합성하지 않는다. recovered directive는 observe이고 실행권이 아니다. 이전 owner의 정상 closed lease A와 recovered B가 함께 있으면 A의 실제 receipt는 그대로 ACK하고 B는 receipt 대상에서 제외한 채 서버 release를 요청한다. oldowner retired 뒤 새로운 instance/lease/job identity로만 다음 작업을 받을 수 있다. historical 보충은 기존 fence/immutable request로 허용하며 복구 권한을 되돌리지 않는다.

## Risks / Trade-offs

- [HTTP 계약 변경] → Checker artifact 고정 후 Engine 검증과 실제 양측 통합을 순서대로 진행한다.
- [lease만으로 이미 실행 중인 기기를 멈출 수 없음] → 로컬 cutoff 취소+유한 cleanup, 종료 불명 quarantine, 서버 자동 재배정 금지.
- [디스크 장애/프로세스 강제 종료] → 실행전 intent, 전송전 outbox, startup reconcile, 확인되지 않은 side effect 재실행 금지. 파일시스템 밖의 절대 exactly-once를 주장하지 않는다.
- [서버가 허용 범위 밖 target을 배정] → 운영자 allowlist를 별도 검사하고 실행전 거부한다.
- [정상 작업까지 격리될 수 있음] → 안전한 미실행/격리 상태를 운영 화면에 노출하며 기기 확인 후 명시 해제한다.
- [임의 adapter 또는 JS 동기 무한점유] → child process 경계와 timeout을 사용하지만 native 외부 session 정리를 확증할 수 없으면 quarantine한다.

## Migration Plan

1. Checker HTTP schema/fixtures/version/hash와 이 change의 identity·시간·복구 의미를 확정한다.
2. Engine에 pinned protocol과 독립 transport/state tests를 추가하고 기존 core package regression을 유지한다.
3. Desktop을 실행하지 않은 환경에서 실제 Checker 서버+별도 Agent child+Chromium PASS/FAIL/cancel/reconnect/restart 인수한다.
4. alpha.6 새 tgz/실행 bundle과 Agent protocol pin을 기록한다. alpha.5 소비자는 기존 API/CLI를 계속 쓴다. rollback은 Agent 명시 종료·미확정 resource quarantine 후 이전 local runtime을 사용한다.

HTTP artifact 고정 이후 apply를 시작한다. 구현 tasks는 실제 검증한 항목만 완료 표시하며 아직 미검증인 Agent 기능을 지원 완료로 광고하지 않는다.
