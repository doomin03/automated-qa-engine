# Spec Delta

## Purpose

다른 서비스와 Desktop이 독립 패키지 CLI를 자식 프로세스로 실행할 때 입력 오류를 조기에 발견하고, 출력 소비가 중단되어도 실행 취소와 내구 결과를 잃지 않도록 한다.

## ADDED Requirements

### Requirement: Command arguments are explicit
CLI SHALL 명령별 positional 개수와 허용 flag를 검증하고, 남는 positional·무관한 flag·충돌하는 headed/headless를 INVALID_ARGUMENT exit 2로 거부한다. 기존 유효 명령과 stdout 기본 진단 및 opt-in stderr transport는 유지한다.

#### Scenario: Invalid input cannot silently validate
- **WHEN** validate FILE에 두 번째 파일, --once 또는 --headed/--headless를 전달한다
- **THEN** CLI는 입력 오류 한 건과 exit 2를 반환하고 browser/session/run artifact를 만들지 않는다

#### Scenario: Existing valid commands remain usable
- **WHEN** 지원되는 run --json --control-stdin, preset expand, export 또는 agent --config --once를 호출한다
- **THEN** 명령별 공개 옵션과 위치를 유지하고 기존 JSON/JSONL 구조를 반환한다

### Requirement: Output delivery cannot block execution lifecycle
CLI SHALL stdout/stderr 미소비·닫힘·상속 pipe 상태에서도 실행 event loop, 취소, timeout과 cleanup을 계속 처리한다. 출력 큐와 전달 대기는 유한해야 하며 실패한 전달은 재실행을 유발하지 않는다. 전달 실패 exit 3은 실제 디스크 판정과 구분한다.

#### Scenario: Windows consumer never reads stdout
- **WHEN** 256노드 웹 실행의 JSONL stdout을 읽지 않고 run timeout을 1500ms로 지정한다
- **THEN** CLI는 외부 강제 종료 없이 12초 watchdog 안에 종료하며 schema-valid result.json과 terminal event를 디스크에 남기고 실행을 다시 시작하지 않는다

#### Scenario: Cancel while the pipe is stalled
- **WHEN** stdout 미소비 상태에서 stdin cancel을 전달한다
- **THEN** CLI는 cancel을 처리하고 유한 cleanup을 수행하며 실제 결과와 전달 실패를 구분한다; 출력 성공 또는 cancelled를 합성하지 않는다

#### Scenario: Closed stdout or stderr
- **WHEN** 소비자가 출력 pipe를 닫거나 진단 stderr를 읽지 않는다
- **THEN** CLI는 무한 replay/무제한 메모리 큐 없이 종료하고 접근 가능한 실행 디스크 결과는 보존한다

### Requirement: Ordered durable event consumption is preserved
CLI SHALL 정상 소비에서 event runId/attempt/sequence와 원래 JSONL을 유지하고 이미 전달한 이벤트를 중복 출력하지 않는다. 전달 실패 후 새 실행으로 이벤트를 재생성해서는 안 된다.

#### Scenario: Healthy consumer and suite cancellation
- **WHEN** 소비자가 출력과 stderr를 읽으며 ordered Suite 중간에 취소한다
- **THEN** 실행별 sequence, terminal/result, exit 의미를 유지하고 이후 case를 시작하지 않는다

### Requirement: Lightweight queries do not initialize execution adapters
CLI SHALL --version과 --help를 browser/서버/session 초기화 없이 처리한다. package import와 공개 API의 기존 독립성은 유지하고 실제 cold-start 전후 측정을 공개한다.

#### Scenario: Installed package quick query
- **WHEN** 별도 프로젝트에서 설치된 aqa --version 또는 --help --json을 반복 실행한다
- **THEN** 기존 출력 형식을 유지하며 Playwright 실행 준비나 Agent 서버 연결 없이 종료한다
