# Spec Delta

## ADDED Requirements

### Requirement: Definite assignment of public captured variables
Engine은 명시 public captured variable만 수집하고 모든 실행 경로에서 초기화된 값을 후속 입력·검사·분기에 SHALL 사용한다.

#### Scenario: Both paths initialize
- **WHEN** 합류 전 모든 경로가 변수를 성공적으로 capture한다
- **THEN** 합류 후 읽기를 허용하며 실제 실행 경로에서 얻은 값만 사용한다.

#### Scenario: Uninitialized or failed capture
- **WHEN** 초기화 전 읽기나 한 경로의 미초기화 또는 재수집 실패가 있다
- **THEN** compile 거부 또는 실행 실패로 종료하며 이전 값을 재사용하지 않는다.

### Requirement: Bounded non-sensitive observation
Engine은 secret 혼용과 민감 DOM을 거부하고 값 크기·DOM 순회·run deadline을 SHALL 제한한다.

#### Scenario: Sensitive or excessive source
- **WHEN** password/OTP/명시 민감 조상·후손 또는 한도 초과 값이 관측된다
- **THEN** 값 반환 없이 blocked로 기록하고 비밀값을 진단에 포함하지 않는다.

#### Scenario: Public value reuse
- **WHEN** 비민감 공개 값 수집과 후속 XML 실행이 성공한다
- **THEN** runtime 변수로만 사용하고 source/event/result에 캡처 문자열을 직렬화하지 않는다.
