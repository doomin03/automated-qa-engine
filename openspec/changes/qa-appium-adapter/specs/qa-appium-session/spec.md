# Spec Delta

## Purpose

독립 QA Engine에서 명시적인 로컬 실행 설정으로 Android/iOS Appium 세션을 열고 오류·취소·정리를 제어하며 실제 기기 검증 범위를 정확히 전달한다.

## ADDED Requirements

### Requirement: Explicit local execution configuration

시스템 SHALL Blueprint 외부의 endpoint/capabilities로 세션을 생성하고 Android/iOS만 허용한다. endpoint는 기본 loopback HTTP(S)이며 명시 allowRemoteEndpoint=true에 한해 원격 HTTPS를 허용한다. URL 자격증명·query·fragment는 거부한다. udid/deviceName 및 플랫폼에 맞는 automationName은 필수다. TV와 지원하지 않는 selector/명령은 blocked 오류로 거부한다.

#### Scenario: Configuration remains outside source
- **WHEN** Android target과 명시된 로컬 endpoint 및 UiAutomator2 capability가 입력된다
- **THEN** 플랫폼이 일치하는 W3C 세션을 만들며 Blueprint의 임의 endpoint를 사용하지 않는다

#### Scenario: Unsupported configuration
- **WHEN** opt-in 없는 원격 endpoint나 플랫폼과 불일치하는 driver/platformName이 입력된다
- **THEN** 세션을 만들기 전에 거부하고 설정값을 오류에 노출하지 않는다

#### Scenario: Explicit remote server
- **WHEN** allowRemoteEndpoint=true이며 자격증명 없는 원격 HTTPS endpoint와 특정 udid가 제공된다
- **THEN** 명시된 서버에만 연결하고 redirect나 기기 자동 선택은 하지 않는다

### Requirement: Bounded and sanitized transport

시스템 SHALL 응답 크기와 요청 시간을 제한하고 HTTP redirect를 거부하며 server error message/stacktrace/응답 본문을 public 오류에 포함하지 않는다. 세션 종료는 진행 중 요청을 중단하고 알려진 세션에 제한된 DELETE를 수행한다.

#### Scenario: Failed or malformed server
- **WHEN** 서버가 오류 본문, 잘못된 JSON 또는 한도를 넘는 응답을 반환한다
- **THEN** 정제한 SESSION_ERROR 또는 해당 capability 오류를 반환하고 성공으로 보고하지 않는다

#### Scenario: Cleanup after interrupted request
- **WHEN** 실행 중 endSession이 호출된다
- **THEN** 진행 중 요청을 중단하고 알려진 세션 삭제를 최대 4초 이내에 시도한다

#### Scenario: No command after exhausted step deadline
- **WHEN** input의 clear 요청이 step deadline을 소진한다
- **THEN** value 요청을 추가 전송하지 않으며 TIMEOUT의 phase를 step으로 기록한다

### Requirement: Separate protocol and hardware acceptance

시스템 SHALL 실제 Android/iOS 실행과 로컬 protocol 서버 검증을 별도로 보고한다. 세션 생성 응답을 받기 전 HTTP 연결 취소는 서버측 세션 ID를 알 수 없음을 문서화하고 유한 newCommandTimeout을 설정한다.

#### Scenario: No device available
- **WHEN** 로컬 Appium 서버나 기기가 제공되지 않는다
- **THEN** 프로토콜 테스트 결과만 기록하고 실기기 인수는 미완료로 남긴다
