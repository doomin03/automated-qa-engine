# Tasks

## 1. P0 기획과 구조

- [x] 1.1 실제 저장소·참조 branch·도구 현황과 제약을 문서화한다.
- [x] 1.2 역할 경계·계약 초안·counterpart·인수 시나리오를 작성한다.
- [x] 1.3 고정 dependency 설치와 foundation/OpenSpec strict 검증 결과를 기록한다. 근거: docs/validation.md.

## 2. P1 로컬 실행 preview 구현 및 인수

- [x] 2.1 Dart/Node IPC spike와 Windows cleanup 검증 후 runtime ADR·SDK 버전을 확정한다. ADR 001과 정상 shutdown 증거 참조; 강제 IPC 복구는 생산 구조에서 제거했다.
- [x] 2.2 contracts JSON Schema와 유효/무효 fixtures를 구현한다.
- [x] 2.3 schemaVersion·graph·selector·target·secret 검증을 구현한다.
- [x] 2.4 ExecutionPlan/interpreter/timeout/retry/cancel과 Runner port를 구현한다.
- [x] 2.5 unit/contract 테스트에서 오류 분류·redaction·terminal 불변성을 검증한다. 로컬 run별 결과/증거 격리; 서버 재전송 의미는 P4다.

## 3. 완료 처리

- [ ] 3.1 실제 검증 증거를 연결하고 미완료 기능이 없는지 확인한 뒤 기준 spec sync/archive를 수행한다.

