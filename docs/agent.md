# 독립 Agent (alpha.8 local preview)

이번 v2 저장 형식 인수는 별도 테스트 state에서 수행했다. 실제 서비스 배포나 기존 사용자 state 이동·삭제·마이그레이션을 실행하지 않았다. 운영 적용은 아래 버전·용량·복구 경계를 검토한 명시 작업이어야 한다.

`aqa agent --config agent.json`은 Desktop이 꺼져 있어도 별도 프로세스에서 승인된 작업을 가져와 설치된 Engine CLI child로 실행한다. 일반 package import와 `aqa run`은 중앙 서버를 필요로 하지 않는다. 실제 Checker 서버와 독립 설치 Agent의 웹 PASS/FAIL/cancel, ordered Suite, 응답 유실, 재시작·운영자 복구, PNG 자산 및 게시 Suite 예약 인수는 alpha.6에서 수행한 이력이다. alpha.7 이후 인수는 별도 설치·HTTP fixture 소비와 테스트 state의 v2 checkpoint에 한정하며 Checker 기본 pin·기존 서버/운영 Agent는 alpha.6를 유지한다. alpha.8은 내부 state/service/materialize/reporting 책임을 분리하고 동일 protocol·journal·실행 제외 정책을 보존한다. 이번 작업은 실제 운영 전환이나 기존 사용자 state migration이 아니다. alpha.5 고정 배포에는 Agent가 없으며 최종 tgz/hash와 각 검증 범위는 소스 저장소의 버전별 검증 기록을 따른다.

```powershell
$env:AQA_AGENT_TOKEN = '<운영자가 발급한 Agent credential>'
aqa agent --config .\agent.json
aqa agent --config .\agent.json --once
```

`--once`는 한 claim 결정(빈 queue 또는 한 lease의 ordered cases)을 처리한다. Ctrl+C/SIGTERM은 새 claim을 중단하고 active child의 stdin 취소를 요청한다. 정상 종료 후 결과·증거 전송과 instance release를 수행한다. 강제 종료나 네트워크 장애는 미확정 작업을 자동 재실행하지 않는다. stdout은 `agent.ready`, `agent.case.started`, `agent.lease.finished`, `agent.delivery.pending` 업무 알림 JSONL이다. 원본 Engine 이벤트는 별도 durable outbox를 통해 서버로 전달한다. Agent 오류는 비밀값을 제외한 고정 메시지를 stderr에 쓰고 exit 3으로 종료한다. 정상 idle/명시 중단은 exit 0이다. 테스트 FAIL은 Engine 결과이지 Agent 프로세스 장애가 아니다.

위 정상 종료는 프로세스가 실제 signal handler를 실행한 경우다. Windows의 강제 Process.kill/taskkill 또는 전원 종료는 handler 실행을 보장하지 않으므로 다음 시작에서 durable state를 유지한 채 reconcile해야 한다. `--once`는 작업이 올 때까지 기다리는 옵션이 아니다. 계속 대기하는 Agent는 옵션을 생략한다.

## 로컬 설정과 실행 범위

```json
{
  "schemaVersion": "qa.agentConfig/v1",
  "agentId": "worker-one",
  "serverUrl": "https://qa.example.com",
  "tokenEnv": "AQA_AGENT_TOKEN",
  "stateDir": "./agent-state",
  "projectIds": ["project-one"],
  "resources": {
    "web-slot-one": {
      "platform": "web",
      "allowedOrigins": ["https://test.example.com"],
      "nativeApps": [],
      "secretRefs": [],
      "actions": ["launch", "tap", "input", "assertText", "screenshot"],
      "allowProduction": false
    }
  },
  "credentials": {},
  "maxRunMs": 60000
}
```

모든 allowlist의 기본은 빈 목록이다. 서버 executionPolicy와 로컬 project/resource/action/origin/native app/credential 범위를 모두 통과해야 실행한다. production은 서버와 로컬의 명시 opt-in 둘 다 필요하다. resourceKey는 서버에 등록된 물리 resource의 canonical identity이며 서로 다른 alias로 같은 기기를 등록하면 이중 소유를 막을 수 없다. 서버 base URL은 HTTPS만 허용하고 local-test loopback HTTP에는 `allowInsecureLocal: true`가 필요하다. redirect와 임의 download URL은 거부한다.

secretRef를 허용하려면 `credentials: {"login-token": "LOCAL_LOGIN_TOKEN"}`와 해당 resource의 `secretRefs: ["login-token"]`, 서버 정책을 모두 설정한다. 환경변수 이름만 설정에 쓰며 원문은 Blueprint/outbox/로그에 기록하지 않는다. child는 기존 `AQA_SECRET_*` 환경을 제거하고 승인된 ref만 다시 넣는다. runtime host 자체의 악성 프로세스에 대한 OS sandbox는 아니다.

native resource는 `appiumConfig`에 운영자 소유 로컬 파일을 지정한다. endpoint/udid를 서버 Blueprint에서 받지 않는다. 세션 생성 전 Android `appium:appPackage`와 정확한 `appium:appActivity`, iOS `appium:bundleId`가 서버와 로컬 nativeApps에 있어야 한다. Android Activity는 양쪽 `activities` 배열에도 있어야 한다. 앱 미지정/autoLaunch=false/다른 wait package·activity는 거부한다. 설치된 앱만 사용하고 Appium app 설치 capability는 기존 adapter에서 거부한다. 검증한 설정의 private 사본을 사용하므로 실행 도중 원본 설정 변경이 세션을 바꾸지 않는다. 이는 시작 앱의 검증이며 이후 OS UI·앱 외부 전환에 대한 OS 격리 보장은 아니다. 실제 Android/iOS 기기 인수는 아직 없다.

Agent 시작 capability whitelist는 `platformName`, `appium:automationName`, `appium:udid`, `appium:deviceName`, `appium:appPackage`, `appium:appActivity`, `appium:bundleId`, `appium:newCommandTimeout`, `appium:noReset`, `appium:autoLaunch`, `appium:appWaitPackage`, `appium:appWaitActivity`, `appium:appWaitDuration`이다. 미지원 launch override와 APK/IPA 설치 요청은 session POST 전에 blocked다. appWaitPackage/Activity는 시작 대상과 동일해야 하고 허용 앱 범위를 넓히지 않는다. Agent는 선택값을 임의 주입하지 않으며 adapter의 newCommandTimeout 기본60초를 사용한다. Android wait duration은 지정 시 1..300000ms, noReset/autoLaunch는 boolean이며 autoLaunch=false는 허용하지 않는다. 이 제한은 Agent에만 적용하고 기존 직접 CLI/API Appium 설정은 그대로 유지한다.

## 계약과 수명

Checker 소유 HTTP protocol은 `contracts/agent-protocol/pin.json`의 version/SHA로 고정한다. 실행 DSL/event/result는 Engine 소유다. 서버의 executionId/jobAttempt/leaseId/fence, caseId/deliverySequence와 Engine의 runId/attempt/sequence를 분리하며 원본 event JSON을 바꾸지 않는다. `engineContractSha256`은 설치된 release bundle **bytes** 해시다.

TTL 30초, heartbeat 5초, HTTP deadline 5초, 안전 여유 5초를 사용한다. 요청 시작 monotonic 시각부터 유효기간을 계산하여 느린 응답이 실행권을 연장하지 않는다. cutoff/stale fence/cancel 시 stdin 취소 후 최대 10초를 기다린다. 강제 종료 또는 native infra_error는 외부 session 종료 불명으로 보며 quarantine한다. 보고 네트워크 장애가 이미 확인된 cleanup을 unknown으로 바꾸지는 않는다.

Suite는 pinned ordered cases를 차례로 실행한다. stopOnFailure나 취소 뒤에는 다음 case를 시작하지 않는다. 각 case의 실제 result만 전송하며 미실행 case의 PASS/result를 만들지 않는다. evidence bytes 검증 및 cleanup confirmed 후 받은 completion receipt와 전송 완료 상태는 테스트 outcome과 별개다.

## 상태와 복구

state root는 agentId에 결합된 단일 writer lock, hash-chain append journal, immutable lease/result/complete bodies, case별 private 파일을 보관한다. 프로세스 부재를 확인할 수 없는 stale lock은 자동 탈취하지 않는다. writer.gate가 남으면 자동 삭제하지 않고 운영자가 이전 프로세스 종료를 먼저 확인해야 한다. PID가 재사용되어 살아 있으면 보수적으로 복구를 거부한다. 서로 다른 state root/머신의 같은 Agent identity는 서버 instance ownership이 막는다.

실행 intent를 child 시작 전에, 이벤트를 HTTP 전송 전에 fsync한다. 네트워크 재전송은 동일 deliverySequence/bytes를 사용한다. 재시작은 reconcile부터 수행하고 기존 실행 intent를 browser action으로 재개하지 않는다. 서버가 조회로 반환한 `resume`도 실행 허가로 취급하지 않는다. 응답 유실로 로컬에서 몰랐던 lease는 서버 reconcile에서 확인하며 불확정 resource를 재사용하지 않는다.

완료 ACK 유실은 closed lease의 completionReceipt/deliveryClosed/evidenceStatus로 복구한다. release의 `ownerStopped=true`는 self에서는 claim/execution supervisor와 child 종료를 확증했다는 뜻이며 reporter는 ACK 수신 중 살아 있다. 이전 instance 복구에서는 이전 OS process 부재도 확인한다. 서버는 별도로 모든 lease/cleanup/evidence/receipt를 검증하고 owner instance를 영구 retired 처리한다. historical evidence 업로드는 실행권·TTL·lock을 변경하지 않는다.

저널은 최대 64MiB/20,000 records이고 개별 record 4MiB, 큰 lease(최대 7MiB)·전송 body는 별도 immutable file/hash reference를 쓴다. 자산·증거는 각각 실행 총량 64MiB와 파일 10MiB 제한이 있다. 실행 전 최소 256MiB 여유 공간을 검사한다. alpha.7은 아래 확정 이력 압축을 제공하지만 immutable 증거 파일의 일반 GC는 제공하지 않는다. 용량/디스크 오류는 실행 중단과 운영 복구가 필요한 상태다. state root를 지워 기존 작업을 다시 실행하는 것은 복구 절차가 아니다.

candidate-1은 빈 queue도 1초 polling마다 claim intent와 empty 결정 2 records를 누적해 약 10,000회(요청 시간을 제외하면 약 2시간 47분) 뒤 한도에 도달할 수 있었다. 후속 소스는 확정 HTTP204 empty claim 128개마다 또는 한도 근처에서 해당 claim의 requested/empty set operation만 retire한다. 다른 과거 operation 순서와 event/ACK/history/receipt는 보존하고 새 hash-chain journal을 exclusive 임시 파일→fsync→atomic replace로 교체한다. 새 파일로 교체하기 전후의 crash 5개 경계와 제한40에서400 idle operations를 검증했다. 이 수정은 candidate-1 tgz에 들어 있지 않으며 candidate-2 이후 재인수한다.

alpha.7 checkpoint는 모든 key의 최신 값을 보존하며 중복 set 이력과 내구 ACK된 payload를 압축한다. queue-base에 ACK high-water/next sequence를 기록하고 미ACK 이벤트는 순서대로 남긴다. claim/lease/unknown/active/historical/receipt/released/tombstone은 삭제하지 않고 immutable body/evidence 파일도 유지한다. exclusive writer·fsync·atomic replace와 crash 복구를 적용한다. v1 저널을 읽지만 checkpoint 후 v2가 되므로 같은 state의 alpha.6 이하 downgrade는 거부된다. 롤백은 실행/전송 중단과 서버 reconcile·운영자 검토 뒤 보관된 별도 환경을 사용해야 하며 과거 state를 지워 재실행하면 안 된다.

내부 store.status()는 journalVersion, remainingEntries/remainingBytes, retainedKeys/queueScopes/pendingEntries/acknowledgedPayloadEntries, lifetimeBounded를 제공한다. 공개 agent CLI의 추가 상태 질의 명령은 아니다. tombstone/key·미확정 payload·증거 파일은 계속 증가하므로 무제한 수명이 아니다. 안전하게 회수할 이력이 없으면 stderr `AGENT_STATE_FULL`, exit3으로 종료한다. 운영자는 사용량을 관찰하고 정상 전송·receipt/release를 마친 state를 보관한 뒤 서버 운영 절차에 따라 새 identity/resource를 명시적으로 등록해야 한다. 불확실 실행은 quarantine 및 실제 프로세스/session 확인을 거친다.

이전 process가 죽은 뒤 빈 claim owner만 남아 있는 경우에도 첫 요청 전 기록한 instanceId/ownerPid와 서버 전체 reconcile을 대조한 뒤 empty receipt release를 시도한다. 서버 또는 로컬에 미확정 lease가 하나라도 남으면 이 경로로 해제하지 않는다. Appium 생성 POST 이후 ID 또는 DELETE 미확증은 cancelled라도 CLEANUP_ERROR/unknown이며 자동 재배정하지 않는다.

## 운영자의 명시적 resource 복구

candidate-2 이후의 HTTP pin 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490은 `recovered` 상태와 nullable operatorRecovery를 추가한다. 관리자가 실제 이전 process/session 종료를 확인하고 Checker에서 사유와 idempotency를 기록한 경우에만 서버가 복구 ID/시각/이전 fence/증가한 fence를 발행한다. Agent는 모든 reconcile 페이지, 기존 immutable lease, 이전 OS PID 부재를 확인한다. 기존 cleanup unknown/failed와 QA result는 그대로 보존하고 local phase만 recovered로 기록한다.

이는 예전 실행의 PASS/정상 cleanup/완료 receipt를 만드는 기능이 아니다. recovered directive는 observe이고 원래 실행을 다시 시작하지 않는다. 같은 이전 owner에 정상 closed 작업의 미ACK receipt가 있으면 그 실제 receipt까지 검증·ACK한다. recovered 작업은 receipt 합성 대상에서 제외한다. 서버가 owner를 retired 처리한 뒤 새로운 instance/lease/job identity로만 다음 작업을 시작한다. 운영자가 확인했다고 하더라도 이전 PID가 살아 있거나 fence 증분·identity가 틀리면 자동 진행하지 않는다. historical evidence는 예전 requestId/fence로 보충할 수 있지만 실행권을 되돌리지 않는다.
