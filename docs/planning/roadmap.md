# 제품 기획과 단계별 인수 기준

## 목적과 사용자

QA 담당자가 공통 TestCase/Suite를 내려받아 Flow를 편집하고, 동일 정의를 Desktop·CLI·Agent에서 실행해 증거와 주간 회귀를 공유한다.
qa_editor는 정의를 작성하고 qa_tester는 허용된 환경에서 실행한다. qa_manager는 게시·배정·일정·검토를 관리하며 system_admin은 조직/권한/Agent 운영을 맡는다. viewer는 허용 범위에서 결과를 읽는다.
역할은 Checker 서버가 조직/프로젝트 범위에서 검사하며 엔진은 업무 역할을 알지 않는다.

## 핵심 사용 흐름

1. 로그인 후 프로젝트와 고정된 Suite 버전을 선택한다.
2. TC(번호/제목/목적/사전조건/단계/expected/priority/tags/platform/Flow)를 조회하거나 편집한다.
3. Flow builder에서 노드·분기·selector·timeout/retry를 편집하고 오류를 확인한다.
4. engine capability에 맞는 target을 선택해 실행하고 node event/로그/스크린샷을 확인한다.
5. 서버에 시간대와 함께 주간 예약을 등록한다. Desktop 종료 여부와 실행은 독립이다.
6. 동일 TC/Flow 버전·환경·target·브랜치·앱 빌드 비교 정책에 따라 전주 결과와 비교한다. 불일치 시 비교 불가 사유를 표시한다.
7. 관리자가 업무 검토 상태를 갱신하고, 실행 판정과 독립적으로 알림을 보낸다.

## 단계와 완료 증거

| 단계 | 범위 | 인수 증거 | 현재 상태 |
| --- | --- | --- | --- |
| P0 | 조사, 기획, 경계, 계약 초안, OpenSpec, 설정 | 저장소별 foundation 검사 + strict spec 검증 + lockfile 설치 | 이번 작업 |
| P1 engine | schema/graph/selector/secretRef, interpreter, CLI, Playwright | 실제 로컬 웹 PASS와 의도적 FAIL; screenshot/result/exit code; timeout/cancel/crash cleanup | 미구현 |
| P2 checker | Flutter TC/Flow CRUD, drag/drop, undo/redo, CLI 연결, 결과 표시 | UI → engine validate → 실제 웹 run → 결과; round-trip 계약 | 미구현, P1 release 필요 |
| P3 checker | Slack OIDC/RBAC, 관리자, immutable registry, 승인/다운로드/diff | 게시 → 버전 고정 다운로드; 다른 프로젝트 접근 거부 테스트 | 미구현 |
| P4 양쪽 | Agent, scheduler, device lease, 결과 수집/회귀/알림 | 중복 occurrence 한 번 실행, offline/missed 구분, replay 중복 제거 | 미구현 |
| P5 engine | Appium Android/iOS, 플랫폼별 TV | 기기/OS/driver/로그 증거; 미지원은 unsupported | 미구현 |
| P6 | 화이트박스, AI 보조, recorder/export | allowlist/sandbox, 사람 검토, 실제 실행 증거 | 미구현 |

P0를 끝냈다고 P1 제품이 실행된다는 뜻은 아니다. 실제 실행 기능이 없는데 성공 결과를 반환하는 placeholder를 만들지 않는다.

## 우선순위와 제외 범위

첫 제품 마일스톤은 서버/GUI 없는 CLI의 실제 브라우저 수직 슬라이스다. 다음은 같은 Flow의 Flutter 편집·실행·증거 확인이다.
서버 승인/주간 예약/모바일/TV는 이 마일스톤을 건너뛰어 대규모 scaffolding하지 않는다. 코드 생성은 선택 export이며 기본 실행은 interpreter다.

## 공통 인수 기준

- 실패는 assertion_failed / environment·driver infra_error / unsupported / cancelled로 구분한다.
- 테스트 outcome과 업무 progress, schedule occurrence, unrun을 각각 관리한다.
- immutable snapshot, artifact hash, engine/schema version으로 재현성을 기록한다.
- secret은 참조만 저장하며 CLI stdout은 JSON/JSONL, 진단은 stderr로 분리한다.
- 해당 단계의 format/lint/typecheck/unit/contract/build/E2E를 실제 구현 후 CI에 추가한다. 현재 검사는 제품 테스트를 대체하지 않는다.

