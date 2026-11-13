# Proposal

## Why

웹 전용 실행기만 있어 Android/iOS 앱의 같은 선언형 Flow를 실행할 수 없다. 사용자 승인 범위의 모바일 앱 조작을 별도 Appium adapter로 추가하고 실기기 인수와 프로토콜 검증을 구분한다.

## What Changes

- 독립 import 가능한 AppiumAdapter와 타입, 기본 로컬 W3C HTTP transport 및 명시적인 원격 HTTPS opt-in을 추가한다.
- Android/iOS native selector와 launch/tap/input/clear/waitFor/assertion/screenshot/mobileBack/hideKeyboard를 지원한다.
- endpoint와 device capabilities는 실행 설정으로 전달하고 Blueprint에 저장하지 않는다.
- bounded timeout/cleanup, 오류 정제, secret screenshot 차단과 프로토콜 회귀 테스트를 제공한다.

## Capabilities

### New Capabilities

- `qa-appium-session`: 로컬 Appium 세션 수명·격리·오류 처리.
- `qa-mobile-actions`: native selector 기반 앱 조작·assertion·증거.

### Modified Capabilities

없음. 현재 보관된 baseline specs가 없으며 기존 실행기와 병행하는 추가 capability다.

## Impact

integrationId: qa-appium-adapter. counterpart: automated-qa-checker의 향후 모바일 실행 소비. contractVersion: 0.2.0-draft.1 제안(Engine 담당자가 schema/bundle 통합). dependsOn: qa-flow-schema-core, qa-runtime-resilience. Runtime: 0.1.0-alpha.4 통합 대상.

소유 범위는 runners/appium, tests/appium.test.mjs, docs/appium.md와 이 change다. core/schema/compiler/CLI/package 통합은 Engine 담당자가 단독 수정한다. npm 새 의존성은 없다. 서버 자동 설치/시작, 앱 설치, arbitrary execute/shell, TV, WebView context 전환은 제외한다. 실기기 없는 환경의 protocol PASS를 device PASS로 바꾸지 않는다.
