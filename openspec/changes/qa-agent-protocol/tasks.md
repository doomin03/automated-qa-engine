# Tasks

## 1. Protocol pin and optional entry

- [x] 1.1 Checker 정본 endpoint/DTO/시간/identity/fixture artifact를 version/hash로 고정하고 동일·상이 payload/누락 필드/오류 응답의 양측 계약 테스트와 소유권 문서를 추가한다.
- [x] 1.2 optional aqa agent/config/transport를 core와 분리하고 설치 help/명시 시작·종료, core import 무네트워크·무프로세스 회귀와 CLI 사용 문서를 검증한다.

## 2. Policy and materialization

- [x] 2.1 기본 빈 project/target/device/credential allowlist와 server scope 교집합을 구현하고 과도한 origin·native app·secretRef·production 거부 및 비밀값 비노출 테스트로 검증한다.
- [x] 2.2 ordered pinned cases/자산을 bounded private root에 materialize하고 hash·탈출·symlink·원격 URL·중복 파일 거부 및 XML compile 동등성 테스트와 입력 문서를 추가한다.

## 3. Supervision and leases

- [x] 3.1 durable claim intent/requestId와 child CLI 실행을 구현하고 최초 caseCount=1 실제 웹 PASS/FAIL, event identity/step.skipped/retry 전이를 검증한다. 다중 Suite 완료로 표시하지 않는다.
- [x] 3.2 요청 시작 monotonic 기반 heartbeat/cutoff/fencing/cancel을 구현하고 응답 지연·연결 상실·stale fence·정리 timeout 테스트 및 실제 Windows child stdin 취소로 검증한다.
- [x] 3.3 local state/resource lock 및 server instance ownership/quarantine/release 기록을 구현하고 동일 agentId의 두 프로세스·다른 state root, 이중 claim, unknown native session, PID 재사용과 종료 불명 resource 재사용 거부를 검증하고 운영 복구 문서를 추가한다.
- [x] 3.4 pinned Suite execution policy와 ordered multi-case를 통합하고 stopOnFailure/취소 후 후속 case 미실행, case별 원본 run identity 및 전체 전송 cursor를 실제 서버/Agent에서 검증한다.

## 4. Durable transport and recovery

- [x] 4.1 deliverySequence outbox/ack/result/artifact 업로드를 구현하고 중복 동일 요청·충돌 payload·ack 유실·부분 업로드·디스크/용량 오류 회귀 및 판정/전송 상태 구분을 검증한다.
- [x] 4.2 startup reconcile과 unknown outstanding lease 복구를 구현하고 side effect 직후 restart·claim 응답 유실·전송 재개·자동 재실행 금지 및 quarantine 유지 테스트와 복구 절차를 추가한다.
- [x] 4.3 confirmed204 empty claim만 retire하는 bounded atomic journal checkpoint를 추가하고 장시간 empty polling/중간 crash/rename 실패/active·unknown·outbox·receipt 보존 회귀로 검증한다. candidate-1은 보존하고 변경분은 candidate-2 이후에 인수한다.
- [x] 4.4 Checker 운영자 recovered 계약을 새 artifact hash로 정합하고 oldPID 부재/full reconcile/복구 fence 검증과 원본 QA 상태 보존을 구현한다. recovered-only 및 closed receipt 미ACK+recovered 혼합 owner의 새 identity 실행을 실제 서버에서 검증한다.

## 5. Cross-repository acceptance

- [x] 5.1 Desktop을 종료한 환경에서 실제 Checker 서버와 별도 설치 Agent 프로세스의 웹 PASS/FAIL/cancel/reconnect/restart, 프로젝트 권한·독점 resource·실제 event/result/artifact를 양측 교차 인수한다.
- [x] 5.2 alpha.6 새 tgz를 sibling source 없는 소비 프로젝트에 설치하여 기존 API/CLI 무서버 회귀·타입·Agent 명령을 검증하고 전체 verify/protocol pin/정확 hash 및 모바일 미검증 범위를 인계한다.

## Workflow follow-up

- 현재 Checker protocol SHA는 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490이다. candidate-1의 754b35 계약과 실제 서버 증거는 역사로 보존한다. candidate-2 독립 설치 인수 후 실제 Checker 교차 검증을 진행하며 checkbox는 해당 전체 인수가 끝난 뒤 갱신한다.
- 4.3 증거: tests/agent-checkpoint.test.mjs의 40-record budget/400 empty polling, 5개 crash 경계, replace 실패 및 비어 있지 않은 모든 operation 보존 회귀 PASS. tests/agent-cli.test.mjs의 reclaim 불가 20,000-record 상태는 명시 exit3를 확인했다. 관리자의 별도 800-write probe도 unknown claim/unacked event 보존과 reopen을 확인했다.
- 1~4/5.1 인수: docs/validation-alpha.6.md와 artifacts/agent-nest-candidate2, agent-nest-resource, agent-nest-scheduled의 실제 Nest/별도 설치 CLI 결과를 대조했다. 서버 담당자는 receipt ACK·resource free·원본 unknown 유지와 PNG hash를 DB에서 독립 확인했다. retry는 started 1회→retrying→finished이며 skipped는 step 판정으로만 허용하는 공통 ingestion 회귀도 서버에서 통과했다. native lost-session/cleanup-timeout은 실제 CLI+HTTP protocol fixture로 unknown을 확인했으며 실제 기기로 표시하지 않는다.
- 5.2 최종 인수: artifacts/package/0.1.0-alpha.6/verification.json, tgz SHA33dbcacea025fb98a52fb0411af05cb113bc85e47e84a98463912b6aace1acef. consumer0g9kd5의26 runs/TS/Agent matrix PASS. candidate-2와 final74파일의 차이는 README.md/docs/agent.md뿐이다. 전체158tests PASS 뒤 추가 native 불확증 회귀 포함 파일3tests PASS. 계약·후보·최종 해시와 실제 모바일 미검증을 docs/validation-alpha.6.md에 기록했다.
- 추가 인수 정합: UNC/absolute 5가지 입력의 schema/policy/materialize 거부·resource 요청0회 focused 회귀를 tests/agent-protocol.test.mjs에 추가하고 해당 파일5tests PASS를 확인했다. 기존 artifact 회귀의 부분 전송 검증과 실제 PUT ACK-loss/restart는 구분한다. 후자의 실제 Nest 인수는 Checker 담당자가 추가 검증하며 완료 근거를 혼용하지 않는다. 제품 payload와 고정 tgz는 변경하지 않는다.
- alpha.5 고정 tgz/bundle을 덮어쓰지 않는다. commit/push/publish/archive는 이 할당에 포함하지 않는다.
- 실제 모바일 환경이 없으면 protocol 테스트를 실기기 인수로 표시하지 않는다.
