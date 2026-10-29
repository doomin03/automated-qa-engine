# Proposal

## Why

사용자가 Figma 또는 다른 도구에서 내보낸 디자인 이미지·명시 수치와 실제 웹을 비교하고 기본 입력·가림·뒤로가기 UX를 검증하려 한다. 현재 Engine은 실행·PNG 증거 수집을 제공하지만 이미지 비교·수치 측정·UX 전용 assertion은 제공하지 않는다.

## What Changes

- 도구 중립 로컬 reference bundle에 PNG/hash, 수치 기준, selector mapping과 실행 profile을 선언한다. 이미지·수치·행동 검사를 각각 판정한다.
- 웹에서 baseline/actual/diff 및 허용 오차를 갖는 이미지 assertion과 bbox/간격/허용 CSS 수치 assertion을 제공한다.
- 동작 전 viewport/hit-target 관측 → tap → focus → input → value 검사 및 웹 history back → 기대 URL/화면 확인 preset을 제공한다.
- 명시적으로 선택한 local versioned preset을 사용자 target/selector/expected binding으로 구체 Blueprint/XML에 전개한다. 전개는 실행하지 않는다.
- PNG와 JSON 검사 증거, reference/profile hash, 비교불가·차이·수집실패 이유를 독립 패키지/CLI로 소비한다.
- alpha.2 runtime/기존 artifact는 보존하며 신규 계약은 공개 draft다. 실제 출시 버전/hash는 구현 인수 후 별도 고정한다.

## Capabilities

### New Capabilities

- qa-design-reference: 기준 리소스·실행 profile·비교 가능성·검사 증거 계약.
- qa-visual-comparison: 명시 PNG 기준과 실제 웹 이미지의 허용 오차 비교.
- qa-layout-measurement: selector의 위치/크기/간격/허용 style 수치 비교.
- qa-web-ux-presets: 명시 binding으로 전개하는 기본 웹 입력/history UX 검사.

### Modified Capabilities

없음. 기준 specs는 아직 없으며 기존 XML/독립 패키지 change를 선행 조건으로 소비한다.

## Impact

- integrationId: qa-design-ux-demo
- contractVersion: pending (기존 배포 계약 0.1.0-draft.1은 변경하지 않음)
- dependsOn: qa-user-web-desktop-handoff / qa-flow-schema-core / qa-playwright-runner
- counterpartRepoChange: automated-qa-checker/openspec/changes/qa-design-ux-demo
- acceptanceCriteria: 외부 tgz consumer와 실제 Chromium에서 이미지·수치 PASS/의도적 FAIL, profile/크기 불일치 blocked, overlay/focus/history fixture, timeout/cancel·증거 hash·XML 왕복을 검증한다. 현재 신규 tasks는 모두 미완료다.
- 영향: Engine 정본 schema/compiler/adapter/runner, 공개 API/types/CLI/pack과 release 검증. arbitrary JS/shell은 추가하지 않는다.
- 제외: 직접 Figma API, 서버, 검사 도구 자체의 UI 품질 작업, Appium/실제 OS 키보드/모바일 system back, 고급 UI. 실지원은 웹이다.
