# Spec Delta

## Purpose

Engine을 특정 QA 앱이나 서버에 종속되지 않는 독립 패키지로 제공하여 다른 프로젝트가 선언형 테스트를 검증·실행하고 취소·이벤트·결과를 안정적으로 소비할 수 있게 한다.

## ADDED Requirements

### Requirement: Independent public package surface
Engine은 패키지 이름으로 import 가능한 문서화된 검증·계획·실행 API와 별도 Playwright adapter 진입점 및 aqa CLI를 SHALL 제공한다. core는 구체 adapter나 Flutter/Checker/중앙 서버 없이 로드되어야 한다.

#### Scenario: External consumer
- **WHEN** sibling repo 없는 프로젝트가 생성된 tgz를 설치하고 패키지 이름으로 import한다
- **THEN** 문서화된 public API를 사용하여 사용자 정의 Blueprint를 검증하고 계획을 생성할 수 있다.

#### Scenario: Web automation
- **WHEN** consumer가 Playwright adapter를 주입하여 실행한다
- **THEN** Engine이 실제 웹을 제어하며 GUI/서버 실행 없이 PASS와 assertion FAIL을 구분한다.

### Requirement: Import without execution
Engine은 공개 core/adapter 패키지 import만으로 browser/session/child process를 SHALL 시작하지 않는다. 실제 실행 자원은 consumer의 명시적 실행 요청 이후에만 생성한다.

#### Scenario: Read only import
- **WHEN** consumer가 패키지를 import하고 schema 또는 API 정의를 조회한다
- **THEN** 브라우저 설치/세션/실행 프로세스가 시작되지 않는다.

### Requirement: TypeScript consumer contract
Engine은 공개 API의 .d.ts와 타입 문서를 SHALL 배포하여 TypeScript consumer가 입력·실행 options·events·results 및 adapter 경계를 확인할 수 있게 한다.

#### Scenario: Installed type declarations
- **WHEN** 독립 TypeScript 프로젝트가 tgz를 설치하고 public root/adapter exports를 사용한다
- **THEN** 배포된 타입 선언으로 정상 사용의 typecheck가 성공하고 잘못된 API 사용은 타입 오류로 검출된다.

### Requirement: Explicit lifecycle API
실행 API는 명시적 취소 신호, 순서 있는 versioned 이벤트, terminal result와 안정된 오류 코드를 SHALL 제공하며 오류·취소 시 adapter 자원을 정리한다.

#### Scenario: Consumer cancellation
- **WHEN** 실제 실행 중 consumer가 취소 신호를 보낸다
- **THEN** 후속 action을 멈추고 cleanup 후 cancelled 결과를 반환한다.

#### Scenario: Consumer event handling
- **WHEN** consumer가 event callback으로 진행을 수신한다
- **THEN** runId/attempt별 sequence가 증가하고 node 상태와 terminal 결과를 연결할 수 있다.

#### Scenario: Callback or input failure
- **WHEN** 입력 검증이나 event callback이 실패한다
- **THEN** 성공으로 처리하지 않고 문서화된 오류/infra_error 경계로 전달하며 시작된 session을 정리한다.

### Requirement: Reproducible package release
Engine은 runtime/bundle/tgz 버전과 hash/integrity를 함께 기록하고 설치된 패키지의 실제 CLI/API 인수 증거를 SHALL 제공한다.

#### Scenario: Isolated installation acceptance
- **WHEN** 독립 임시 consumer에 alpha.2 tgz를 설치한다
- **THEN** 설치 CLI와 public API가 실제 브라우저 PASS/FAIL·취소·events/result/evidence를 검증하며 source 상대경로를 요구하지 않는다.

#### Scenario: Unsupported platform
- **WHEN** 아직 구현하지 않은 Appium Android/iOS 또는 TV capability를 요청한다
- **THEN** 미지원으로 거부하며 실제 제어 성공이나 실기기 검증 완료를 주장하지 않는다.
