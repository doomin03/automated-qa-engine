# Tasks

## 1. P0 기획과 구조

- [x] 1.1 실제 저장소·참조 branch·도구 현황과 제약을 문서화한다.
- [x] 1.2 역할 경계·계약 초안·counterpart·인수 시나리오를 작성한다.
- [x] 1.3 고정 dependency 설치와 foundation/OpenSpec strict 검증 결과를 기록한다. 근거: docs/validation.md.

## 2. P1 로컬 실행 preview 구현 및 인수

- [x] 2.1 고정 Playwright dependency와 credential 없는 local HTML fixture를 추가한다.
- [x] 2.2 adapter의 session/action/assertion/evidence/cleanup을 구현한다.
- [x] 2.3 aqa validate/run/devices/doctor와 exit code/JSONL transport를 구현한다.
- [x] 2.4 실제 브라우저 PASS/FAIL, selector 없음, timeout/cancel/crash 테스트를 실행한다. crash는 browser disconnect 시나리오로 검증했다.
- [x] 2.5 result/event/evidence 스키마 검사와 artifact hash/path 검사를 통과시킨다.
- [x] 2.6 배포 가능한 CLI와 schema fixture bundle 버전/hash를 생성하고 Checker 소비 계약을 갱신한다. local npm pack을 임시 디렉터리에 설치하고 실제 PASS/FAIL smoke를 통과했다. 원격 게시 없음.

## 3. 완료 처리

- [ ] 3.1 실제 검증 증거를 연결하고 미완료 기능이 없는지 확인한 뒤 기준 spec sync/archive를 수행한다.

