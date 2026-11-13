# Design

## Context

runner의 catch가 emit(step.finished)를 await하며 여기서 최초 callback 오류가 나면 finally 후 result 저장으로 가지 못한다. 기존 tests는 정상 경로 observer 실패와 terminal 실패만 다뤘다. 사용자가 미완료 보완을 승인했고 관리자가 alpha.3 신규 release 및 실패 보존 의미를 승인했다.

## Goals / Non-Goals

**Goals:** 실패 처리 중 observer 오류와 실제 파일 저장 오류를 분리하며 원래 판정·terminal 기록을 보존한다.
**Non-Goals:** 파일 I/O 장애에도 무조건 result 생성, 동기 무한 event loop 강제종료, schema 변경. CLI 제어 옵션은 별도 change에서 추적한다.

## Decisions

- emit의 callback catch 안에만 실패 정리 모드를 적용한다. 바깥 catch로 emit 전체를 삼키면 appendFile/schema 오류까지 은폐하므로 채택하지 않는다.
- 이미 실행 failure가 확정된 경로는 observer 오류를 cleanupErrors의 ENGINE_ERROR/phase cleanup으로 기록하고 observer를 끈다. AbortSignal이 늦게 들어와도 원래 failure/outcome을 바꾸지 않는다.
- 정상 경로 observer 실패는 기존 ENGINE_ERROR/infra_error, terminal callback 실패는 기존 persisted result + API reject다. event/raw callback 오류에 비밀값을 포함하지 않는다.
- 미응답 observer는 기존 남은 run deadline을 사용한다. failure evidence 3초/endSession 5초/terminal observer 1초를 유지한다.
- runtime alpha.3에 후속 CLI 개선도 묶어 한 번 pack한다. 계약 draft.1/schema v1과 alpha.2 tgz/bundle/XML bytes는 보존한다. package verification metadata는 버전 디렉터리에 보존하여 이전 증거를 덮어쓰지 않는다.

## Risks / Trade-offs

- 이미 실패한 실행에 뒤늦게 취소가 와도 최초 판정 우선 → 이 경계를 문서와 회귀로 고정한다.
- custom adapter의 side effect와 동기 무한 점유는 강제 종료 불가 → 기존 제한을 유지한다.
- 새 pack 전에 문서/CLI가 바뀌면 hash 달라짐 → 모든 공개 포함 파일 완료 뒤 pack/독립 소비 인수한다.

## Migration Plan

회귀 재현 → 최소 수정/실제 Chromium → CLI 후속 change 완료 → alpha.3 bundle·tgz 인수 → Checker exact pin 인계. 기존 alpha.2 설치는 바꾸지 않는다.
