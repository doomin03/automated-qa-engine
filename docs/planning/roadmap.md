# 제품 기획과 단계별 인수 기준

2026-11-12 정합. 이 표는 초기 P0 계획을 보존하면서 현재 Engine 코드와 실제 인수 근거를 연결한다. Checker 전체 제품 완료 상태는 해당 저장소의 OpenSpec/검증 기록이 정본이며 Engine 결과만으로 대신 판정하지 않는다.

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
| P0 | 조사, 기획, 경계, 계약 초안, OpenSpec, 설정 | [초기 검증](../validation.md), 현행 foundation/strict | 완료 이력; 기준 spec sync/archive 행정은 별도 잔여 |
| P1 engine | schema/graph/selector/secretRef, interpreter, CLI, Playwright | [alpha.8 독립 패키지](../validation-alpha.8.md), [alpha.9 작성 인수](../validation-alpha.9.md) | 실제 구현·인수 완료. [alpha.10](../validation-alpha.10.md)은 취소 전달 보완 인수 중 |
| P2 checker | Flutter TC/Flow 편집, CLI 연결, 결과 표시 | Engine alpha.8 설치 소비 및 alpha.9 Dart compose 교차 인수 | 미구현 단계가 아님. D08 다중 터미널/native final·앱 Release 및 전체 UI 인수는 Checker가 별도 관리 |
| P3 checker | OIDC/RBAC, immutable registry, 승인/다운로드/diff | Registry→Flutter→결과 서버 연계 이력은 [alpha.6](../validation-alpha.6.md) 참조 | 서버 협업 코드와 로컬 인수 존재. 실제 Slack/운영 계정·권한/배포 전체 인수는 Checker 최신 기록 확인 |
| P4 양쪽 | Agent, scheduler, device lease, 결과 수집/회귀/알림 | alpha.6 실제 Nest 예약·중복/재연결/수동복구·artifact 인수 | optional Agent 구현·교차 인수 완료. 최신 Engine로 서버/Agent/Desktop pin 통합 및 운영 인수는 별도, 회귀 비교·알림 완료를 Engine가 대신 주장하지 않음 |
| P5 engine | Appium Android/iOS, 플랫폼별 TV | [Appium 지원 범위](../appium.md) 및 protocol 회귀 | Appium protocol 구현·검증, Android/iOS 실제 장치 task3.2 미완료. TV adapter 미구현 |
| P6 | 화이트박스, AI 보조, recorder/export | [작성 계약](../document-authoring.md), [XML](../xml-format.md) | AI가 편집할 수 있는 DSL·템플릿/합성·export는 구현. CodeTestAdapter/sandbox 및 동작 recording은 미구현 후속 |

원본 PHASES_AND_ACCEPTANCE는 Whitebox를 Stage5, AI/Recorder를 Stage6으로 구분한다. 위 표의 초기 P6 묶음이 이 구분을 바꾸지 않는다. 실제 실행 기능이 없는데 성공 결과를 반환하는 placeholder를 만들지 않는다. 실기기 부재, 제품 구현 미완료, sync/archive 행정 및 운영 승격을 [잔여 범위](../architecture/remaining-engine-gaps-20261112.md)처럼 분리한다.

## 우선순위와 제외 범위

첫 CLI/브라우저 수직 슬라이스 이후 Flutter 소비와 서버/Agent 교차 인수까지 진행했다. 현재는 검증된 새 runtime을 전달하고 서버/Agent/Desktop의 exact pin을 맞춘 뒤 실제 통합 및 다른 PC 환경을 인수하는 순서다. 모바일 실기기·TV·whitebox·recorder는 각각 필요한 환경과 별도 명세를 갖춘 후 진행한다. 코드 생성은 선택 export이며 기본 실행은 interpreter다.

## 공통 인수 기준

- 실패는 assertion_failed / environment·driver infra_error / unsupported / cancelled로 구분한다.
- 테스트 outcome과 업무 progress, schedule occurrence, unrun을 각각 관리한다.
- immutable snapshot, artifact hash, engine/schema version으로 재현성을 기록한다.
- secret은 참조만 저장한다. CLI stdout은 JSON/JSONL이며 기본 오류 transport는 호환을 위해 stdout, `--diagnostics stderr` 선택 시 stderr로 분리한다.
- 해당 단계의 typecheck/unit/contract/build/E2E를 실제 증거로 확인한다. 로컬 검증 통과와 원격 CI/운영 배포 성공은 구분한다.

