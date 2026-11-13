# Spec Delta

## Purpose

사용자가 명시한 웹 요소에서 기존 Engine selector 문법으로 표현 가능한 제한된 locator 후보를 수집하고 현재 고유성과 동일성을 검증하여, 자동 실행이나 recorder 완료를 주장하지 않고 검수 가능한 작성 자료를 제공한다.

## ADDED Requirements

### Requirement: Explicit bounded locator inspection
Engine은 web target/launchAlias/seed를 명시한 요청에만 SHALL 접근하며 기존 origin·production 정책과 유한 timeout/cancel/cleanup을 적용한다. 문서 생성·검증이나 import만으로 검사를 시작하지 않는다.

#### Scenario: Explicit inspected page
- **WHEN** 사용자가 허용된 web target와 유일한 seed를 지정한다
- **THEN** 새 session에서 명시 launch URL을 검사하며 클릭·입력·QA run 없이 후보 envelope를 반환하고 session을 정리한다.

#### Scenario: Policy or unsupported scope
- **WHEN** production opt-in이 없거나 off-origin, native target, iframe/shadow/canvas, 민감 입력 범위다
- **THEN** 정책/미지원 진단으로 거부하고 성공 후보나 QA PASS를 합성하지 않는다.

### Requirement: Verify limited candidate identity
Engine은 한 요소의 data-testid/id만으로 기존 testId/css 후보를 SHALL 생성하며 현재 고유하고 같은 요소인 후보만 반환한다. 불안정한 위치/nth-child나 본문 기반 후보를 자동 생성하지 않는다.

#### Scenario: Unique escaped identifiers
- **WHEN** seed 요소에 CSS escaping이 필요한 id와 고유 data-testid가 있다
- **THEN** 올바른 기존 selector 문법으로 순서가 결정된 후보를 만들고 각각 실제 같은 요소에 매칭되는지 확인한다.

#### Scenario: Duplicate or changing DOM
- **WHEN** 후보가 여러 요소를 가리키거나 검사 도중 요소가 detach/교체되거나 지원 속성이 없다
- **THEN** 해당 후보를 제외하고 bounded 진단을 제공하며 향후 안정성 또는 테스트 성공을 주장하지 않는다.

### Requirement: Minimize collected data and preserve documents
Engine은 입력값·innerText·HTML·스크린샷·credential을 수집하지 않고 명시한 속성만 SHALL 길이 제한하여 읽는다. 입력·출력 크기와 direct API 객체를 검증하며 기존 문서를 자동 수정하지 않는다.

#### Scenario: Untrusted input and large attributes
- **WHEN** 입력에 getter/toJSON/경로 우회/초과 문자열이나 큰 속성이 있다
- **THEN** 위험한 호출 없이 입력을 거부하거나 길이 초과 속성을 후보에서 제외하고 bounded 출력과 sanitized 진단을 남긴다.

#### Scenario: Output file already exists
- **WHEN** CLI --out 파일이 이미 존재한다
- **THEN** 원본/기존 파일을 보존하며 오류를 반환하고 자동 덮기나 Flow 변경을 하지 않는다.

### Requirement: Independent packaging and honest inspection status
Engine은 새 locator 계약과 optional web-tools API를 독립 설치 가능한 package에 SHALL 제공하되 기존 실행·작성·Agent schema와 alpha.10 artifact를 유지한다. inspected는 QA outcome이 아니며 후보 적용과 run은 별도 명시 행위다.

#### Scenario: Standalone consumer
- **WHEN** 저장소 없는 프로젝트에서 검증된 새 tgz를 설치해 API/bin을 사용한다
- **THEN** 실제 local Chromium 후보·오류·timeout/cancel·cleanup과 public 타입을 검증하고 core import만으로 browser나 네트워크를 시작하지 않는다.
