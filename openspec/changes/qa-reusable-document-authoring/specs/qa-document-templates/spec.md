# Spec Delta

## Purpose

UI나 AI provider에 종속되지 않은 Engine 기술 템플릿을 공개하고, 사용자가 명시한 bindings와 고정된 버전/hash로만 기존 실행 문서를 생성하도록 한다. 작성 성공과 실제 QA 실행을 분리하며 기존 데모·preset·repeat 및 실행 계약을 유지한다.

## ADDED Requirements

### Requirement: Versioned technical template catalog
Engine은 listTemplates 및 CLI templates list/show로 authoring 계약 버전, template id/version/raw SHA-256, binding schema, 지원 플랫폼과 필요한 actions를 SHALL 제공한다. design D2의 empty/web-open-click/web-input-check/native-open-check만 MUST 제공하며 연결 기기 가용성을 만들어내지 않는다.

#### Scenario: Discover exact bindings without execution
- **WHEN** 외부 consumer가 catalog 또는 특정 id/version을 조회한다
- **THEN** 실제 정의와 일치하는 hash/schema/capability가 반환되고 browser/Appium/network/secret resolver를 호출하지 않는다

#### Scenario: Reject unsupported template selection
- **WHEN** 알 수 없는 id/version 또는 지원하지 않는 platform을 요청한다
- **THEN** 명시 오류를 반환하고 유사 template나 예제값으로 대체하지 않는다

### Requirement: Complete pinned bindings
Engine은 templateId/version/sha256/bindings가 필요한 createTemplate을 SHALL 제공한다. 필수·미지 필드, 플랫폼 locator, launch alias를 MUST 검증한 뒤 compile된 Blueprint와 왕복 동등 XML을 반환한다. 값 누락 시 구조화 진단만 MUST 제공하고 부분 실행 문서를 반환하지 않는다.

#### Scenario: User supplies a complete web template
- **WHEN** web-open-click에 실제 target/selectors/launch/selector/id와 올바른 template pin을 제공한다
- **THEN** launch→waitFor→tap의 기존 DSL 문서와 유효 snapshot hash를 반환하고 자동 실행하지 않는다

#### Scenario: Missing bindings or altered template pin
- **WHEN** 필수 selector가 누락되거나 template SHA가 다르다
- **THEN** 오류 필드 진단을 반환하고 fixture selector/URL로 채운 성공 문서를 반환하지 않는다

#### Scenario: Empty document is not a composed action block
- **WHEN** empty template에 유효 target/id를 제공한다
- **THEN** start→end 문서를 생성하지만 실제 검사 성공이라고 표시하지 않으며 이 자산을 compose하면 최소 동작 노드 제약으로 거부한다

### Requirement: Secret references and native configuration boundary
Engine은 credential을 resolve하지 않고 from:secret 변수와 valueRef/expectedRef로만 secret binding을 MUST 표현한다. native template은 기존 target/selector manifest를 SHALL 사용하며 runtime endpoint/device/provider 설정을 알 수 없는 binding으로 MUST 거부한다.

#### Scenario: Input template uses a secret reference
- **WHEN** web-input-check의 value가 secretRef 객체다
- **THEN** 원래 secret ref를 가진 변수와 input/assertValue 참조를 생성하고 실제 secret 값이나 resolver 호출이 없다

#### Scenario: Native document is generated without device proof
- **WHEN** native-open-check에 유효 Android/iOS target와 플랫폼 locator가 제공된다
- **THEN** launch→assertVisible 문서를 검증하며 기기 연결/실제 테스트 성공을 주장하지 않는다

### Requirement: Public isolated authoring distribution
Engine은 runtime alpha.9에 authoring contract 0.1.0-draft.1/schema/types/예제/고정 template 정의를 SHALL 포함한다. 실행 schema draft.2/Agent protocol 바이트, 기존 template/preset/expand 의미와 frozen alpha.6/alpha.8을 MUST 보존한다. Checker 소비는 검증된 archive/manifest 인계를 MUST 선행조건으로 한다.

#### Scenario: Consume from a standalone installed package
- **WHEN** sibling repository가 없는 별도 프로젝트에 검증된 tgz를 설치한다
- **THEN** package 이름 API와 npm bin으로 catalog/생성을 호출하고 타입·schema·bundle/file hash를 확인할 수 있다

#### Scenario: Existing consumer stays on its pinned runtime
- **WHEN** Checker 서버 alpha.6 또는 기존 alpha.8 consumer를 그대로 사용한다
- **THEN** 자동 pin 변경이나 저장 문서 재작성 없이 기존 동작이 유지되고 새 작성 기능 부재를 명시한다

### Requirement: Explicit execution acceptance
template 생성은 순수 작성 연산으로 SHALL 유지한다. 인수는 생성 XML의 공개 plan 및 명시 웹 실행 PASS/의도 FAIL 증거를 MUST 별도 검증한다. native 생성/protocol 증거를 실기기 실행이라고 MUST NOT 보고한다.

#### Scenario: Generated template is explicitly executed later
- **WHEN** 사용자가 생성 XML을 명시 run한다
- **THEN** 기존 실행 정책/secret/timeout/cancel 계약을 적용하고 generation 성공과 별도로 실제 event/result/evidence를 판정한다
