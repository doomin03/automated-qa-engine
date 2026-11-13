# Spec Delta

## Purpose

웹과 같은 Flow 구조에서 Android/iOS native selector를 사용해 설치된 앱을 조작하고 assertion 및 이미지 증거를 수집하며 미지원 동작과 비밀정보 노출을 구분한다.

## ADDED Requirements

### Requirement: Native selectors and actions

시스템 SHALL 플랫폼별 accessibilityId/id/xpath selector로 launch/tap/input/clear/waitFor/assertVisible/assertText/assertValue/screenshot/mobileBack/hideKeyboard를 수행한다. input은 기존 값을 지운 뒤 새 값을 입력한다. selector가 여러 element를 가리키면 모호한 대상으로 거부한다.

#### Scenario: Native input and assertions
- **WHEN** 설치된 앱 ID와 native selector로 입력 후 text/value assertion을 실행한다
- **THEN** 해당 플랫폼의 selector를 사용하고 실제 반환값과 expected를 정확히 비교한다

#### Scenario: Referenced expected value
- **WHEN** assertValue가 expectedRef로 선언된 변수를 참조한다
- **THEN** 실행 시 해석된 문자열과 정확히 비교하며 secret 변수이면 screenshot을 차단하고 실제 값을 오류에 쓰지 않는다

#### Scenario: Unsupported driver operation
- **WHEN** back 또는 hideKeyboard를 driver가 unsupported로 응답한다
- **THEN** UNSUPPORTED_CAPABILITY로 종료한다

### Requirement: Wait state semantics

시스템 SHALL waitFor의 attached/detached를 element 존재로, visible/hidden을 존재와 displayed 값으로 판정한다. missing element는 hidden/detached를 충족하며 assertion의 missing/mismatch는 failed다. transport 실패는 assertion 실패로 바꾸지 않는다.

#### Scenario: Hidden element remains attached
- **WHEN** element가 존재하지만 displayed=false다
- **THEN** attached/hidden은 성공하고 visible/detached는 제한 시간 후 실패한다

### Requirement: Protected and bounded evidence

시스템 SHALL screenshot 응답을 제한된 PNG 파일로 저장하며 비밀 변수가 있는 실행에서는 screenshot 요청을 보내지 않는다. 비밀값·selector값·서버 본문은 public 오류에 포함하지 않는다.

#### Scenario: Secret input
- **WHEN** secretRef에서 공급된 값이 input으로 전달되고 evidence가 요청된다
- **THEN** 입력은 driver에 전달되지만 screenshot은 생성하지 않는다

#### Scenario: Invalid screenshot
- **WHEN** screenshot 응답이 PNG가 아니거나 크기 한도를 넘는다
- **THEN** EVIDENCE_ERROR를 반환하고 파일을 성공 증거로 저장하지 않는다
