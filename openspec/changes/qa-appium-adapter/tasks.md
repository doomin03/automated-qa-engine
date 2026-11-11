# Tasks

## 1. Session transport

- [x] 1.1 Appium constructor/type와 bounded W3C session transport/cleanup을 구현하고 protocol 서버의 성공·오류·timeout·삭제 테스트 및 docs/appium.md 설정 설명으로 검증한다.

## 2. Native actions

- [x] 2.1 Android/iOS selector, launch/input/clear/tap/wait/assertion/back/hideKeyboard와 secret/PNG evidence를 구현하고 두 플랫폼의 protocol 요청·결과·오류 테스트 및 지원표로 검증한다.

## 3. Integration acceptance

- [x] 3.1 Engine 담당자에게 schema/CLI/package 통합 계약을 전달하고 adapter protocol 전체 테스트와 OpenSpec strict 및 타입 검증 결과를 기록한다.
- [ ] 3.2 실제 Android와 iOS Appium 서버·기기로 PASS/의도적 FAIL/취소/cleanup을 실행하고 result/events/artifact 및 driver/device 버전을 기록한다. 미설치 환경은 미완료로 남긴다.

## Workflow follow-up

- core/schema/CLI/package export와 전체 npm verify/package 소비 검증은 Engine 담당자 통합 작업이다.
- 원격 publish/commit/archive는 수행하지 않는다.
