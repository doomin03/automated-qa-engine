# Design

## Context

현재 CLI는 signal handler만 제공하며 Windows pipe kill은 graceful cancel이 아니다. 오류는 stdout JSON이다. qa-runtime-resilience와 함께 alpha.3으로 배포하며 실행 schema draft.1은 유지한다.

## Goals / Non-Goals

**Goals:** 기본 소비자 호환, Windows child stdin 취소, 명시 진단 stream, bounded 비신뢰 control parsing.
**Non-Goals:** stdin Blueprint/secret 입력, 임의 명령, 원격 transport, OS 강제 kill 복구.

## Decisions

- --control-stdin은 run/run-suite에서만 유효하다. 한 줄 UTF-8 JSON 객체 `{"type":"cancel"}`만 허용하고 key 추가도 거부한다. LF 또는 CRLF를 허용한다. 첫 cancel 뒤 listener를 정리하며 중복 취소는 효과가 없다.
- byte buffer는 한 줄 4096 bytes 이하, 전체 수신 65536 bytes 이하를 제한한다. streaming chunk 분할 UTF-8은 완성된 줄에서 fatal decoder로 검증한다. 원문은 출력하지 않는다.
- 빈 EOF는 listener 정리만 한다. 미완성 줄 EOF/invalid JSON/unknown command/UTF-8/한도 초과/read error는 INVALID_CONTROL 진단 1회와 ENGINE_ERROR AbortSignal로 실행을 중단한다. 이미 확정된 실패는 resilience의 최초 판정 정책이 우선이다. 그렇지 않은 실행은 infra_error/exit3이다.
- --diagnostics의 기본 stdout을 유지하고 stderr 선택을 제공한다. parseArgs가 실패해도 명시 stderr 선택을 원시 인자에서 식별하여 parser 진단을 같은 stream으로 보낸다. event/정상 조회는 항상 stdout이다.
- 종료 finally에서 listener를 제거하고 CLI가 소유한 opt-in stdin을 destroy한다. Windows pipe는 pause만으로 handle이 남을 수 있어 상위 프로세스가 stdin을 열어둬도 완료 process가 대기하지 않게 한다.
- CLI entry는 인자/help, 문서·조회 명령, 실행 명령, control parser 모듈로 나누고 기존 공개 API/bin 경로를 유지한다. 사용자는 설치된 aqa와 public exports로 소비하며 내부 모듈 파일 경로를 요구하지 않는다.
- API 취소가 observer 전달을 끈 경우 CLI는 execute 반환 뒤 해당 run의 durable events를 schema/runId/attempt/연속 sequence로 검증하고 마지막 실제 출력 sequence 이후만 출력한다. Suite는 각 run의 sequence를 분리한다. stdout 오류는 무한 재전송하지 않고 sanitized ENGINE_ERROR/exit3으로 종료하며 이미 저장된 result는 바꾸지 않는다. 출력 write 완료를 await한다.
- child pipe integration은 실제 Chromium의 긴 waitFor 단계에서 cancel/invalid를 보내고 result/schema/sequence/exit/cleanup을 검사한다. EOF는 정상 PASS로 검증한다. decoder 단위 검증과 실제 OS pipe 인수를 분리한다.

## Risks / Trade-offs

- malformed 제어가 실행을 끊음 → opt-in이며 안정된 진단과 infra_error로 명시, pass로 숨기지 않는다.
- cancel이 이미 확정된 결과 뒤에 도착함 → 결과 불변/최초 실패 우선. client는 취소 클릭 자체를 cancelled 결과로 합성하지 않는다.
- stdout 기본 오류 혼재는 남음 → 호환을 유지하고 신규 Checker에는 stderr 옵션을 권장한다.

## Migration Plan

명세/회귀 → CLI control 구현 → alpha.3 독립 설치 Windows pipe 인수 → Checker pin/옵션 인계. 기존 alpha.2 원본과 기본 args는 보존한다.
