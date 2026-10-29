# Tasks

현재 상태: 설계 문서 작성 단계이며 아래 구현은 모두 미완료다. 기존 change의 완료 항목과 alpha.2 release는 변경하지 않는다.

## 1. Public reference contract

- [ ] 1.1 reference/profile, preset, check-report 및 신규 action params의 Engine 정본 schema와 `.d.ts`를 구현하고 유효·누락·unknown-field·단위·미지원 capability 테스트와 공개 계약 예제로 검증한다.
- [ ] 1.2 Blueprint references/target.profile의 JSON/XML 정규화와 compiler 검증을 구현하고 왕복 의미/hash·악성 XML 거부·기존 alpha.2 Blueprint 호환 테스트 및 XML 문서를 갱신한다.
- [ ] 1.3 reference root containment/realpath/hash/PNG 크기 제한을 구현하고 경로 탈출·symlink·hash 변조·손상/초대형 PNG 회귀와 리소스 준비 문서로 검증한다. decoder 후보와 정확 pin은 관리 검토에 기록한다.

## 2. Web observations and image comparison

- [ ] 2.1 Playwright profile/readiness 적용과 무변경 관측 port를 구현하고 viewport/DPR/font 조건 불일치 및 timeout 테스트와 profile 사용 예제로 검증한다.
- [ ] 2.2 PNG 비교와 baseline/actual/diff를 구현하고 실제 Chromium 동일 화면 PASS·의도적 변경 FAIL·경계 threshold·크기 불일치 blocked 및 취소 가능한 decode/비교 테스트로 검증한다. pixel 알고리즘·제한을 공개 문서에 기록한다.
- [ ] 2.3 bbox/gap/font-size 측정과 rule 비교를 구현하고 실제 CSS px·DPR 변환·negative gap·수치 PASS/FAIL·미지원 style 및 auto-scroll 없음 테스트로 검증한다. 기대 수치 source 작성 예제를 제공한다.

## 3. Declarative UX presets

- [ ] 3.1 viewport/hit-target/focus/URL assertion과 browserBack을 구현하고 overlay·화면 밖 요소·focus 방해·정상/잘못된 history fixture에서 실제 PASS/의도적 FAIL/blocked를 검증한다. browserBack retry·허용 origin 및 관측 제한을 문서화한다.
- [ ] 3.2 web-input/web-history-back versioned local preset과 CLI/API list/expand를 구현하고 사용자 임의 binding→검증된 XML 전개, focus-before-fill 순서, 누락 binding 거부 및 import/전개 무실행 테스트로 검증한다. coverage와 미지원 OS 키보드/system back을 예제에 명시한다.

## 4. Durable results and independent package acceptance

- [ ] 4.1 typed observation/check-report JSON 및 PNG artifact 연결을 runner/event/result에 통합하고 공개 schema 검증, 파일 hash·상대 경로·최초 실패 보존·수집 infra_error·secret masking 및 문서 예제로 검증한다.
- [ ] 4.2 신규 검사 중 callback 지속 실패/미응답·terminal 실패·증거 지연·deadline/AbortSignal 시 bounded cleanup을 회귀 테스트하고 취소·오류 의미를 공개 lifecycle 문서와 대조한다.
- [ ] 4.3 외부 임시 프로젝트에 실제 tgz를 설치하여 package-name API/types 및 CLI로 이미지·수치·UX PASS/의도적 FAIL/blocked/cancel을 실행하고 terminal events/result/artifact를 검증한다. source 직접 import 없이 실행되는 소비 예제를 배포 목록에서 확인한다.
- [ ] 4.4 전체 verify와 strict OpenSpec 검증 후 차기 runtime/contract/bundle/XML/preset/tgz 버전·hash·integrity 및 검증 증거를 고정한다. 기존 alpha.2 불변과 이전 XML 회귀를 확인하고 Checker에 metadata를 인계한다.

## Workflow follow-up

- 관리 에이전트가 양쪽 공개 초안 정합성을 검토한 후 별도 apply 업무로 구현을 진행한다. 이번 중간 저장은 문서만 포함한다.
- Checker pin 변경과 통합 인수는 새 Engine artifact 발행 후 별도로 결정한다. 원격 publish는 이번 범위가 아니다.
- 실제 인수와 프로젝트 승인 절차 전에는 archive하거나 기준 specs를 구현 완료 상태로 이동하지 않는다.
