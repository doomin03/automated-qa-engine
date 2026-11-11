# Tasks

## 1. CLI 입력과 시작 비용

- [x] 1.1 명령별 인자/flag 허용표와 충돌 검사를 구현하고 잘못된 입력 exit2·무실행 및 기존 명령 회귀를 통과한다; 공개 CLI 도움말/사용 문서를 정합한다.
- [x] 1.2 가벼운 version/help와 실행 command import를 분리하고 동일 cold fixture 5회 이상 전후 시간·RSS 및 출력 동등성을 기록한다.

## 2. 출력 수명 격리

- [x] 2.1 bounded IPC writer child/ACK/종료 정책을 구현하고 실제 Windows stdout 미소비·취소·EPIPE·stderr 정체에서 12초 watchdog 내 종료와 durable result/terminal을 검증한다; 출력 실패 exit3 및 전달/판정 차이를 문서화한다.
- [x] 2.2 정상 JSONL sequence/replay와 Suite cancel 이후 case 미실행, helper/browser 정리 및 재실행 side effect 없음 회귀를 통과한다. healthy1000노드와 never-resolving observer의 내부 run deadline은 TIMEOUT, 독립 callback reject는 ENGINE_ERROR로 구분하고 API 호환 설명을 갱신한다.

## 3. 결과 계약과 증거 상한

- [x] 3.1 result 노드 목록 1000/contract0.3.0-draft.2/runtimealpha7을 적용하고 1000노드 완료·부분 중단 result/terminal schema 검증 및 공개 bundle/types drift 검사를 통과한다; 호환표를 갱신한다.
- [x] 3.2 artifact256 reservation과 cleanup 진단 집약을 구현하고 257번째 증거·다중 check-report·1000노드/998개 optional 실패·마지막 CLEANUP_ERROR 보존 회귀를 통과한다; 공개 수집 상한을 문서화한다.

## 4. Adapter 수명과 비동기 단언

- [x] 4.1 Web/Appium assertText/assertValue의 단일 deadline polling을 구현하고 실제 로컬 웹 지연 성공·짧은 실패·cancel 및 Appium protocol/fatal/secret 비유출 회귀를 통과한다; 기다림 의미를 API 문서에 명시한다.
- [x] 4.2 Playwright 중복 start와 Appium 생성 중 cancel의 소유권/cleanup 미확증을 보완하고 browser PID 및 원격 session 잔존 fixture/Agent unknown 판정을 검증한다; 실기기 미검증을 유지한다.

## 5. 성능과 Agent 내구 상태

- [x] 5.1 측정상 compiler 유지 결정과 근거를 기록하고 runner successor/visited만 필요한 최소 인덱스로 개선한다; plan/hash/capture 의미 회귀 및 동일 100/1000노드 전후 측정으로 검증한다.
- [x] 5.2 Agent 정상 완료 기록의 상세 checkpoint/ACK high-water/tombstone 설계를 관리 검토받고 strict 재검증한다; 이후 latest-value와 확정 payload 압축을 구현하여 장기 완료·unknown 보존·crash 각 경계·재실행 거부 회귀를 통과하고 용량/운영 절차를 문서화한다.

## 6. 독립 소비와 관리 인계

- [x] 6.0 후보2에서 발견한 step.started 이후 전체 deadline 만료를 예산 출처로 분류하고 내부 run/짧은 node/adapter 임의 TIMEOUT/외부 cancel 반례를 검증한다. 후보2 실패 근거를 보존하고 최신 전체 verify 및 영향 성능 재측정을 수행한다.

- [x] 6.1 system-design/engine-review/검증 문서를 현재 구조와 한계에 맞추고 전체 verify를 통과한다. 기존 alpha6 후속 실제 PUT ACK-loss 근거와 이번 인수를 구분한다.
- [x] 6.2 별도 alpha7 후보 tgz를 설치한 외부 프로젝트에서 API/CLI 실제 웹 PASS/FAIL/timeout/cancel/반복 실행 및 optional Agent 핵심 회귀·타입 소비를 검증하고 package file SHA/bundle/hash/integrity를 기록한다.
- [x] 6.3 관리자 hash/독립 검토와 Checker의 별도 격리 설치 소비 인수를 완료하고 최종 후보를 고정한다. Checker source/default pin·기존 Windows Release/서버/운영 Agent는 alpha6를 유지하며 서비스 승격으로 보고하지 않는다; 미지원 모바일 실기기 및 남은 한도를 명시한다.

## Workflow follow-up

- 사용자 별도 요청 없는 commit/push/publish/archive는 수행하지 않는다.
