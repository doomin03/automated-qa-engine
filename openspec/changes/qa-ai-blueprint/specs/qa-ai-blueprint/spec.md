# AI Blueprint

## ADDED Requirements

### Requirement: Provider neutral authoring
CLI는 특정 AI 공급자 없이 schema/template/import/validate/plan으로 선언형 QA 문서를 작성하고 검사하도록 SHALL 지원한다.

#### Scenario: Import generated XML
- **WHEN** 지정된 XML 형식의 blueprint를 import한다
- **THEN** 같은 JSON 정본으로 변환하고 schema/graph/capability 검증을 수행하며 실행은 시작하지 않는다.

#### Scenario: Reject executable or external entities
- **WHEN** XML에 DTD/entity 선언 또는 Flow에 임의 shell action이 있다
- **THEN** 입력 오류로 거부하고 파일/프로세스 실행을 하지 않는다.

### Requirement: Blueprint progress and explicit execution
GUI는 가져온 정의와 event의 run/attempt/node identity를 검증하고 대기/실행/성공/실패/미실행 상태를 구분해 SHALL 표시한다.

#### Scenario: Review before execution
- **WHEN** 사용자가 AI가 만든 Flow를 가져온다
- **THEN** 검증 결과와 실행 단계를 표시하고 가져오기만으로 실행하지 않는다.

#### Scenario: Replay branch execution
- **WHEN** 한 분기만 실행한 event stream을 불러온다
- **THEN** 방문하지 않은 노드를 성공으로 표시하지 않으며 실패 node/진행을 확인할 수 있다.

