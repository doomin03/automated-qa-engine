# Design

## Parent integration decision — 2026-10-31

CLI `doctor/devices --target android|ios [--appium-config FILE]`는 정적 지원과 설정 유효성만 확인한다. platforms는 요청 platform 하나, supportedActions는 native 목록, targets는 빈 배열이다. diagnostics.nativeConfigured와 connectionVerified:false를 제공하며 서버접속·기기탐색·세션검증을 수행하지 않는다. 설정 없음 exit4, 유효 설정 exit0, 잘못된 설정 exit2다. default web 진단과 호환을 유지한다. config의 udid가 존재한다고 연결된 기기로 광고하지 않는다. 실행 성공은 별도 run에서 판단한다.

## Context

기존 RunnerAdapter는 getCapabilities/startSession/performAction/evaluateAssertion/captureEvidence/endSession을 제공한다. core는 run/step deadline과 terminal evidence/cleanup을 담당하고 adapter에 AbortSignal을 전달하지 않는다. 이 adapter는 endSession 때 진행 중 fetch를 중단한다. 목표 버전 및 책임 경계는 proposal을 따른다.

## Goals / Non-Goals

**Goals:** 추가 npm 의존성 없이 Node fetch로 W3C 세션과 native action을 지원하고 driver 설치 상태와 실제 기기 성공을 구분한다.

**Non-Goals:** 앱 파일 설치, shell/execute, WebView, TV, 자동 서버 시작은 포함하지 않는다. iOS 기기 실행은 Mac의 XCUITest 서버가 필요하며 Windows 환경에서 실제 iOS 인수를 주장하지 않는다.

## Decisions

- `new AppiumAdapter({endpoint,capabilities,requestTimeoutMs=30000,allowRemoteEndpoint=false})`. endpoint는 기본 localhost/127.0.0.1/[::1] HTTP(S)이며 allowRemoteEndpoint=true에 한해 원격 HTTPS를 허용한다. base path 허용, credentials/query/hash/redirect 금지. constructor/import는 네트워크를 시작하지 않는다. capabilities는 JSON object이며 `appium:automationName`은 Android UiAutomator2 또는 iOS XCUITest, platformName은 target과 일치해야 한다. `appium:udid`와 `appium:deviceName`은 비어있지 않은 문자열로 필수다. capability payload는 64KiB 이하, app/browserName/appium:options 등 별도 앱 설치·브라우저 선택 우회는 거부한다. 신뢰된 실행 config의 device 정보는 source XML에 포함하지 않는다.
- W3C POST /session의 alwaysMatch에 platformName과 유한 appium:newCommandTimeout(기본 60초, 1..300)을 지정한다. implicit wait는 0으로 초기화한다. raw sessionId/elementId는 URL segment encoding하며 public 오류에 쓰지 않는다.
- target.platform=android|ios, launchTargets의 value는 package/bundle ID. selectors[alias][platform]은 `{strategy:'accessibilityId'|'id'|'xpath',value}`. web와 공존 가능하며 native platform 필드만 소비한다. compiler/schema는 Engine 담당자가 통합한다.
- `/elements`로 조회하고 하나만 허용한다. 0개는 missing, 여러 개는 blocked다. accessibilityId는 Appium `accessibility id`로 매핑한다. tap→click, clear→clear, input→clear+value. waitFor는 짧은 polling과 전체 node deadline을 공유한다. assertText는 /text, assertValue는 Android attribute/text 및 iOS attribute/value를 사용한다. expected는 정확 비교한다.
- assertValue는 expected 또는 expectedRef 하나를 사용한다. expectedRef는 context.variables에서 String으로 해석하며 secretInputs에 포함된 변수는 screenshot 차단 상태로 기록한다. schema의 참조 존재·단일 필드 검증은 Engine 담당자가 소유한다.
- launch→`/appium/device/activate_app`의 appId. mobileBack→`/back`. hideKeyboard→`/appium/device/hide_keyboard`; false 결과도 실패다. 지원하지 않는 driver는 UNSUPPORTED_CAPABILITY다. arbitrary execute endpoint는 제공하지 않는다.
- action 요청은 JSON body 64KiB, 일반 응답 1MiB, screenshot encoded 응답 14MiB, decoded PNG 10MiB 한도다. transport는 read stream을 한도에서 취소하며 timeout/closed session/invalid response는 정제된 오류다. 종료는 active fetch 중단 후 DELETE 최대 4초. 생성 응답을 이미 수신했으나 closing 상태면 그 ID도 DELETE한다. 응답 전 연결 취소에서 알 수 없는 서버 세션은 newCommandTimeout으로 제한되며 강제 서버 kill을 하지 않는다.
- 세션/step deadline의 남은 시간이 0 이하면 HTTP 요청 전 TIMEOUT으로 거부한다. wait polling과 clear→value는 같은 deadline을 공유하며 만료 후 새 side effect를 시작하지 않는다. deadline timer는 TIMEOUT(해당 phase), 별도 requestTimeoutMs cap이나 실제 통신 실패는 SESSION_ERROR다.
- evidence는 PNG signature/IHDR/IEND와 유한 dimensions(최대 16,777,216 pixels)를 확인한다. 이미지 의미/전체 CRC 디코딩은 Appium evidence 범위가 아니다. secret 실행은 HTTP screenshot 요청 전 skip하며 입력에서 secret 사용을 기억한다. 실제 값이나 driver message는 로그/오류에 포함하지 않는다.
- SDK 구현체나 Appium client 의존성 대신 좁은 W3C HTTP adapter를 선택한다. 작은 allowlist로 public action 의미와 request budget을 직접 관리할 수 있다. core와 외부 Appium 서버는 독립이다.

## Risks / Trade-offs

- 서버가 timeout 뒤 세션을 생성할 수 있음 → 알려진 ID DELETE 및 유한 newCommandTimeout, unknown orphan 한계 문서화.
- driver별 attribute 의미가 다름 → Android text/iOS value 명시 및 실제 기기 인수 필요.
- iOS에서 back/keyboard가 미지원일 수 있음 → unsupported 반환을 blocked로 분류하며 capability 이름을 device 성공 보증으로 사용하지 않음.
- 현재 기기/서버 없음 → 로컬 fake W3C 서버에서 protocol/error/cleanup 검증하고 hardware acceptance task는 미완료 유지.

## Migration Plan

Engine 담당자가 native schema/CLI --appium-config와 package /appium export를 contract 0.2.0-draft.1에 통합한다. alpha.3 기존 산출물은 보존한다. Checker는 새 bundle/version/hash 검증 후 소비한다. adapter 코드만 추가한 단계는 CLI 통합 완료를 뜻하지 않는다.

## Sources

- [Appium W3C protocol](https://appium.io/docs/en/latest/reference/api/webdriver/)
- [Appium extension protocol](https://appium.io/docs/en/latest/reference/api/appium/)
- [Appium session capabilities](https://appium.io/docs/en/latest/guides/caps/)
