# Proposal

## Why

원본 Stage6의 recorder/locator 보조 중 현재 Engine은 선언형 selector를 해석하지만 실제 웹 요소에서 재사용 가능한 locator 후보를 제안하지 않는다. 사용자가 지정한 한 요소의 testId/id 후보를 실제 페이지에서 확인하는 작은 도구부터 제공하면 자동 녹화나 arbitrary script 없이 기존 DSL 작성에 활용할 수 있다.

## What Changes

- 명시 target/launch alias/seed selector로 한 요소를 찾아 data-testid와 id 기반의 기존 testId/css 후보를 반환하는 웹 검사 API/CLI를 제안한다.
- 현재 요소와 후보가 같은 유일 요소를 가리키는지 검증하며, 후보 없음·모호함·미지원·취소·환경 오류를 구분한다. QA 결과 PASS를 생성하지 않는다.
- 별도 `qa.locatorInspection/v1` 입력과 `qa.locatorCandidates/v1` 출력 계약을 공개한다. 기존 실행/작성/Agent schema는 변경하지 않는다.
- 실제 로컬 Chromium 및 독립 package 소비, 부작용 경계·원문 비노출·timeout/cancel/cleanup을 인수한다.

## Capabilities

### New Capabilities

- `qa-web-locator-candidates`: 명시적 웹 요소 관측으로 생성한 검수용 locator 후보와 유한 수명·수집 제한.

### Modified Capabilities

없음. 기준 specs는 아직 비어 있으며 기존 실행 계약과 action/capability 목록은 그대로다.

## Impact

검토 중인 runtime은 alpha.11이다. alpha.10의 archive/payload와 Checker 인수를 보존하고 완료 전 구현하지 않는다. 새 API는 가벼운 core/작성 API와 분리한 `automated-qa-engine/web-tools` 진입점에 둔다. CLI는 명시 inspect-locators 호출에만 이를 로드한다. core→adapter 또는 adapter→schema 의존을 추가하지 않는다. browser 자체는 기존 Playwright session/locator 구성요소를 재사용한다. 최초 ./playwright 직접 export 제안은 정적 역방향 의존을 피하기 위해 이 별도 조립 진입점으로 구체화했다.

- dependsOn: qa-engine-modular-refactor, qa-event-settlement-delivery
- counterpartRepoChange: Checker 후속 locator UI/자료 소비는 별도 할당; 현재 qa-multi-terminal-workbench 변경에 혼합하지 않음
- contractVersion: locator contract0.1.0-draft.1 제안, 실행0.3.0-draft.2/작성0.1.0-draft.1/Agent0.1.0-draft.1 유지
- acceptanceCriteria: 실제 고유성/동일요소 판정, 미지원·민감/큰 입력 경계, 취소/정리, 설치 API/bin/type 검증

동작 recorder·키보드/클릭 수집·Flow 자동수정·whitebox 명령 실행·모바일/TV·운영 자동승격은 포함하지 않는다.
