# Spec Delta

## ADDED Requirements

### Requirement: Opt-in document containment
Engine은 명시 documentRoot가 있으면 모든 로컬 실행 문서 참조의 realpath가 root 내부인지 SHALL 검사한다.

#### Scenario: Escaping reference
- **WHEN** TC/Suite/selector/target의 참조가 root 밖으로 탈출한다
- **THEN** 실행 전 거부하며 미지정 기본 모드는 기존 상대 경로 동작을 유지한다.

### Requirement: Truthful screenshot outcomes
Engine은 screenshot 수집 여부와 required 정책을 step/result에 SHALL 반영한다.

#### Scenario: Optional unavailable evidence
- **WHEN** optional screenshot이 정책상 생략되거나 수집되지 않는다
- **THEN** step skipped로 기록하고 이미지를 얻은 것처럼 passed 표시하지 않는다.

#### Scenario: Required unavailable evidence
- **WHEN** required screenshot이 정책상 생략되거나 수집오류가 발생한다
- **THEN** 각각 blocked 또는 infra_error로 판정하며 기존 첫 실패의 부가 증거 오류는 첫 실패를 보존한다.

#### Scenario: Late evidence completion
- **WHEN** 시간 초과된 adapter 수집이 실패 증거 수집 또는 terminal 이후 늦게 완료한다
- **THEN** 시도별 독립 경로와 취소 검사를 통해 확정 artifact bytes/hash 및 반환 result snapshot을 SHALL 변경하지 않는다.
