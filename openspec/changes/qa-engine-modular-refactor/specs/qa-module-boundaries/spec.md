# Spec Delta

## Purpose

QA Engine의 내부 책임을 재구성해도 소비자가 사용하는 실행 계약과 자원 수명이 유지되도록 한다. 전체 모듈의 변경 근거, 의존 방향, 실제 설치 포함 여부를 검사하여 구조 변경을 검증 가능한 결과로 관리한다.

## ADDED Requirements

### Requirement: Existing public package and CLI entrypoints remain compatible

Engine SHALL 기존 package exports와 타입 signature, aqa bin 및 공개 파일 경로를 유지한다. 내부 재배치는 CLI 명령·옵션·exit code·stdout/stderr·제어 stdin과 실행 DSL 의미를 바꾸지 않는다.

#### Scenario: Existing standalone consumer installs the new package
- **WHEN** 기존 소비자가 새 tgz를 별도 프로젝트에 설치하고 공개 core/adapter import 및 설치 aqa 명령을 실행한다
- **THEN** 정상/오류 타입 소비와 기존 명령은 동일하게 동작하고 새 내부 모듈·worker·child 파일이 모두 포함된다

#### Scenario: Checker resolves public CLI and schema paths
- **WHEN** Checker가 packages/cli/aqa.mjs 기준으로 package root와 공개 schema/versioned bundle을 읽는다
- **THEN** 기존 경로를 유지하고 실제 version/hash에 맞는 계약을 소비할 수 있다

### Requirement: Dependency violations fail automated verification

Engine SHALL 정적 모듈 순환과 허용되지 않은 상향 의존을 검증에서 거부한다. worker/child 경로를 정적 import와 구분하고 계산된 미분류 경로를 검사에서 누락하지 않는다.

#### Scenario: A forbidden dependency is introduced
- **WHEN** core가 구체 runner/CLI/Agent를 import하거나 domain leaf가 실행 계층을 import하는 반례를 검사한다
- **THEN** 검사기는 위반 경로를 보고하며 정상 graph와 구별해 실패한다

#### Scenario: Process boundaries are packaged separately
- **WHEN** CLI writer·image worker·Agent child entry를 검사한다
- **THEN** 별도 프로세스 경로를 ESM cycle로 오판하지 않고 대상 파일 존재와 실제 설치 실행을 확인한다

### Requirement: Source coverage records retained and changed responsibilities

Engine SHALL 기준 source inventory의 모든 runtime/type/generator/script/test 범주에 유지·변경·이동 근거와 검증 대응을 기록한다. 파일 수 감소나 formatter 실행만으로 전체 리팩터링 완료를 주장하지 않는다.

#### Scenario: A source module remains unchanged
- **WHEN** 이미 독립된 책임을 가진 모듈을 유지한다
- **THEN** 유지 이유와 대응 회귀를 기록하고 inventory에서 누락하지 않는다

### Requirement: Parsing and planning preserve validation and snapshot semantics

Engine SHALL 같은 유효 입력의 정규화 Blueprint·snapshot hash·plan 순서를 보존하고 잘못된 입력의 기존 거부 정책을 유지한다. 입력 경로별 보호 강도가 다른 검증을 약한 공통 검사로 대체하지 않는다.

#### Scenario: Equivalent JSON YAML and XML are compiled
- **WHEN** alpha.7과 새 패키지에 동일 정의를 전달한다
- **THEN** runtime version만 제외한 plan과 hash가 일치하고 branch/definite assignment/action 요구가 동일하다

#### Scenario: Direct authoring input contains unsafe object behavior
- **WHEN** getter/toJSON/symbol/비정상 prototype 또는 악성 XML·경로 입력을 전달한다
- **THEN** 기존 각 입력 정책으로 거부하며 리팩터링 때문에 접근·실행·포함 범위가 넓어지지 않는다

### Requirement: Execution ownership preserves lifecycle and durable outcomes

Engine SHALL 실행·event 전달·증거 저장의 책임을 분리해도 순서·판정·retry 예산·deadline 출처·취소·cleanup 의미를 보존한다. 이미 확정된 result와 artifact는 늦은 완료나 전달 실패로 변하지 않는다.

#### Scenario: Deadline and observer failures race
- **WHEN** run 또는 더 짧은 node 예산 만료, callback 자체 오류, 외부 취소가 발생한다
- **THEN** 기존 code/phase와 우선순위를 유지하고 유효한 durable terminal/result 및 cleanup 진단을 남긴다

#### Scenario: Evidence or session completes after cancellation
- **WHEN** 증거 수집·browser launch·Appium 생성의 늦은 완료가 발생한다
- **THEN** 기존 staging/hash 불변과 session 정리 또는 unknown 판정을 유지하며 성공·정리확증을 합성하지 않는다

### Requirement: Optional Agent persistence and recovery preserve execution exclusion

Engine SHALL Agent journal v1/v2 bytes 의미, single writer·fsync·원자 checkpoint·ACK 연속성·미확정 상태·실행 금지 이력을 보존한다. 복구와 historical 전송은 새로운 실행권을 만들지 않는다.

#### Scenario: A checkpoint or restart occurs at a crash boundary
- **WHEN** 기존 crash fixture와 active/unknown/pending/closed/recovered 상태를 새 모듈로 읽고 checkpoint한다
- **THEN** ACK high-water와 pending 순서·latest keys가 보존되고 허용되지 않은 재실행·resource release가 발생하지 않는다

### Requirement: Lightweight and independent consumption remain verifiable

Engine SHALL 공개 core import에서 browser/process/server를 시작하지 않는다. 문서 명령의 검증 경로는 구체 adapter 초기화에 의존하지 않으며 cold/steady 비용을 별도 측정한다.

#### Scenario: Document-only and core-only consumers run
- **WHEN** 공개 core import와 schema/validate/plan을 실제 소비한다
- **THEN** browser/session을 열지 않고 loader trace로 구체 adapter의 불필요한 정적 로딩 제거를 확인한다

### Requirement: New artifacts preserve frozen release provenance

Engine SHALL alpha.7 frozen tgz/bundle을 보존하고 alpha.8 후보를 실제 별도 설치로 검증한 뒤 hash와 파일 manifest를 고정한다. 기존178개 회귀와 추가 구조 검증·Checker 격리 소비를 구분해 보고한다.

#### Scenario: A candidate is promoted after acceptance
- **WHEN** API/CLI/타입/실제 웹·protocol·Agent fixture와 관리/Checker 인수가 완료된다
- **THEN** 동일 검증 bytes를 고정하고 schema·Agent HTTP pin 불변을 확인하며 실기기/운영 승격으로 과장하지 않는다
