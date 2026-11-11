# Spec Delta

## Purpose

데스크톱 또는 외부 프로세스가 설치된 Engine CLI를 pipe로 실행하고 플랫폼별 signal 차이 없이 명시적으로 취소하며 사건과 진단을 안정적으로 구분하게 한다.

## ADDED Requirements

### Requirement: Opt in bounded cancellation channel
run/run-suite는 --control-stdin이 있을 때만 UTF-8 JSONL의 정확한 {type:cancel} 객체를 SHALL 수용하며 기존 AbortSignal 취소/terminal/result/exit5 의미를 유지한다.

#### Scenario: Windows pipe cancellation
- **WHEN** 실제 Windows child process의 진행 event 이후 cancel 한 줄을 stdin에 쓴다
- **THEN** browser 정리 후 cancelled terminal/result와 exit5를 확인할 수 있다.

#### Scenario: EOF and invalid control
- **WHEN** 빈 EOF 또는 잘못된 제어 입력이 도착한다
- **THEN** 빈 EOF는 실행을 취소하지 않고, malformed/unknown/invalid UTF-8/크기 초과/미완성 줄은 원문 없는 진단과 ENGINE_ERROR 중단으로 처리한다.

### Requirement: Compatible diagnostic transport
CLI는 --diagnostics stdout|stderr를 SHALL 제공하고 기본 stdout 오류 객체 및 기존 run JSONL을 유지한다. stderr 선택 시 진단이 event stdout에 섞이지 않는다.

#### Scenario: Input error routing
- **WHEN** stderr 옵션으로 잘못된 argument 또는 input을 전달한다
- **THEN** 오류 JSON은 stderr에만 기록되고 해당 nonzero exit를 유지한다.

#### Scenario: Installed CLI
- **WHEN** 외부 프로젝트에 alpha.3 tgz를 설치해 aqa를 실행한다
- **THEN** 문서화된 버전/진단/취소 옵션이 공개 패키지만으로 동작한다.
