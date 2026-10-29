# Spec Delta

## Purpose

사용자가 작성한 선언형 테스트를 Engine 정본 스키마와 동일한 XML로 배포하고 Desktop이 검증·가져오기·명시 실행할 수 있는 교환 경계를 정의한다.

## ADDED Requirements

### Requirement: Validated user Blueprint XML export
CLI는 지원되는 임의 사용자 Blueprint를 검증한 후 의미를 보존하는 XML로 SHALL 내보낸다. export/import/validate/plan은 실행을 시작하지 않는다.

#### Scenario: User defined round trip
- **WHEN** 예제와 다른 node/action/selector/target 및 metadata를 가진 유효 Blueprint를 XML로 export하고 import한다
- **THEN** 모든 지원 필드와 canonical snapshot hash가 유지된다.

#### Scenario: Invalid or existing output
- **WHEN** 입력 graph가 잘못되거나 출력 파일이 이미 존재한다
- **THEN** nonzero 진단을 반환하고 기존 파일과 브라우저 상태를 변경하지 않는다.

### Requirement: Strict XML boundary
엔진은 DTD/entity 선언, 중복 singleton 요소, 미정의 태그/속성, 혼합 JSON 요소, 과대 입력 및 허용되지 않은 액션을 SHALL 거부한다.

#### Scenario: Nested unknown payload
- **WHEN** params 또는 target의 JSON 텍스트에 XML child나 미정의 속성이 섞여 있다
- **THEN** 실행 전에 INVALID_DOCUMENT로 거부한다.

#### Scenario: Escaped valid text
- **WHEN** 유효한 사용자 값에 XML 특수문자 또는 CDATA 종료 문자열이 포함된다
- **THEN** export/import가 원래 문자열을 보존한다.

### Requirement: Versioned distribution and actual execution
Engine은 버전/hash가 있는 공개 XML fixture 및 실행 계약 artifact를 SHALL 제공하고 XML 실행의 실제 PASS/FAIL을 검증한다.

#### Scenario: XML execution
- **WHEN** 지원되는 사용자 XML을 run --json으로 명시 실행한다
- **THEN** 실제 브라우저를 조작하고 ordered events와 result/evidence를 생성하며 assertion 실패는 nonzero exit를 반환한다.

#### Scenario: Artifact drift
- **WHEN** 공개 artifact 또는 metadata가 원본과 달라진다
- **THEN** 검증 명령이 실패하며 이전 alpha.1 산출물은 덮어쓰지 않는다.
