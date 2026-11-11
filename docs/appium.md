# Appium native 실행

상태: Android/iOS adapter의 로컬 W3C protocol 테스트 통과. **실기기/에뮬레이터 인수는 미검증**이다. 현재 Windows 환경에서 PATH의 adb/appium/xcrun 및 TCP 4723 listener가 확인되지 않았다(2026-10-31). 이 문서는 alpha.4 / contract 0.2.0-draft.1 통합 대상이며 alpha.3 패키지는 Appium을 제공하지 않는다. CLI/schema/package export 완료 여부는 Engine 전체 통합 검증 기록을 함께 확인한다.

## 구성과 책임

`aqa devices --target android --appium-config appium.local.json`과 `doctor --target ios`는 **정적 진단**이다. platforms는 요청 platform 하나, supportedActions는 native 지원 목록, targets는 `[]`이고 diagnostics는 nativeConfigured와 connectionVerified:false를 반환한다. 설정이 유효하면 exit0, 미설정은 exit4, 잘못된 설정은 exit2다. 서버/기기에 접속하지 않으며 udid가 있다는 이유로 연결된 기기로 표시하지 않는다. 실제 사용 가능 여부는 별도 run에서 session을 만들어 확인한다. 기본 web doctor/devices 동작은 유지한다.

Engine는 서버를 설치하거나 시작하지 않는다. 사용자가 테스트할 앱을 설치하고 Appium 서버와 해당 기기의 driver를 준비한다. Android는 UiAutomator2, iOS는 XCUITest를 사용한다. iOS 서버의 macOS/Xcode/기기 준비는 [XCUITest 환경 요구사항](https://appium.github.io/appium-xcuitest-driver/latest/installation/requirements/)을 따른다. 별도 Mac 서버는 HTTPS reverse proxy를 명시적으로 허용하거나 로컬 tunnel로 접속한다.

Blueprint에는 앱 ID와 native selector만 들어간다. endpoint, udid, deviceName, automationName 등은 로컬 실행 설정 JSON으로 분리한다. 기기가 여러 대여도 자동으로 첫 기기를 고르지 않는다. [Appium session capabilities](https://appium.io/docs/en/latest/guides/caps/)의 플랫폼별 driver 설정을 확인한다.

`appium.android.local.json` 예시에서 UDID는 `adb devices -l`로 확인한 실제 값을 넣는다.

```json
{
  "endpoint": "http://127.0.0.1:4723",
  "requestTimeoutMs": 30000,
  "capabilities": {
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:udid": "REPLACE_WITH_ANDROID_UDID",
    "appium:deviceName": "QA Android",
    "appium:newCommandTimeout": 60,
    "appium:noReset": true
  }
}
```

`appium.ios.local.json`은 실제 Mac 서버 또는 tunnel 주소와 기기 UDID를 명시한다. 원격 endpoint는 `allowRemoteEndpoint: true`와 HTTPS가 모두 필요하다. 인증은 조직이 관리하는 연결/tunnel에서 구성하며 URL 사용자명·비밀번호는 허용하지 않는다.

```json
{
  "endpoint": "https://appium.example.test",
  "allowRemoteEndpoint": true,
  "requestTimeoutMs": 30000,
  "capabilities": {
    "platformName": "iOS",
    "appium:automationName": "XCUITest",
    "appium:udid": "REPLACE_WITH_IOS_UDID",
    "appium:deviceName": "QA iPhone",
    "appium:newCommandTimeout": 60,
    "appium:noReset": true
  }
}
```

endpoint 기본값은 없다. 기본 허용 host는 localhost/127.0.0.1/[::1]이며 base path가 필요한 서버에는 `/wd/hub` 등을 명시한다. redirect, URL query/fragment/credentials는 거부한다. requestTimeoutMs는 1..300000, newCommandTimeout은 1..300초다. 앱 파일 설치용 app/appium:app, browserName, appium:options, autoWebview 등은 거부한다. local config는 소스 XML이나 실행 event에 복사하지 않는다.

## 독립 API

통합된 패키지의 공개 진입점은 `automated-qa-engine/appium`이다. core는 package/CLI 외부 서버 없이 호출 가능하며, 실제 모바일 실행에만 사용자가 준비한 Appium이 필요하다.

```js
import { readFile } from 'node:fs/promises';
import { loadBlueprint, executeBlueprint } from 'automated-qa-engine';
import { AppiumAdapter } from 'automated-qa-engine/appium';

const config = JSON.parse(await readFile('appium.android.local.json', 'utf8'));
const blueprint = await loadBlueprint('mobile-smoke.xml');
const { result } = await executeBlueprint(blueprint, {
  adapter: new AppiumAdapter(config),
  reportDir: 'artifacts/mobile',
  timeoutMs: 120000,
});
console.log(result.outcome);
```

AppiumAdapter import와 constructor는 네트워크 또는 child process를 시작하지 않는다. adapter 인스턴스 하나는 세션 하나를 소유하며 종료 후 재사용하지 않는다. 새 실행은 새 인스턴스를 만든다.

## 시나리오 입력

target.platform은 `android` 또는 `ios`, launchTargets는 별칭에서 설치된 package/bundle ID로 매핑한다. 모바일에 allowedOrigins는 적용하지 않는다. selector 별칭의 플랫폼별 필드는 함께 저장할 수 있다.

```json
{
  "input": {
    "web": { "strategy": "testId", "value": "qa-input" },
    "android": { "strategy": "id", "value": "org.example.qa:id/input" },
    "ios": { "strategy": "accessibilityId", "value": "qa-input" }
  }
}
```

지원 native 전략은 accessibilityId/id/xpath다. native selector가 없으면 웹 selector로 대체하지 않는다. 2개 이상 일치하면 UNSUPPORTED_CAPABILITY로 차단한다.

| Flow action | 모바일 의미 |
| --- | --- |
| launch `{target}` | 별칭의 앱 ID activate; 설치/삭제하지 않음 |
| tap `{selector}` | 표시된 element click |
| input `{selector,value}` 또는 `{selector,valueRef}` | clear 후 새 문자열 입력; 비밀 변수는 evidence 차단 |
| clear `{selector}` | 표시된 element clear |
| waitFor `{selector,state}` | visible/hidden/attached/detached; 기본 visible |
| assertVisible `{selector}` | 표시 상태 확인 |
| assertText `{selector,expected}` | native text 정확 비교 |
| assertValue `{selector,expected}` 또는 `{selector,expectedRef}` | Android text attribute / iOS value attribute 정확 비교; expectedRef는 실행 변수를 문자열로 해석 |
| screenshot `{}` | core의 PNG artifact 수집 정책 사용 |
| mobileBack `{}` | W3C back; driver가 미지원이면 blocked |
| hideKeyboard `{}` | driver keyboard 숨김; false면 failed, 미지원이면 blocked |

`hidden`은 element 부재 또는 displayed=false, `detached`는 element 부재다. 붙어 있지만 숨겨진 element는 attached/hidden만 충족한다. keyboardShown 조회 assertion은 아직 지원하지 않는다. 특히 iOS back/keyboard의 실제 지원 여부는 driver와 앱에서 확인해야 하며, capability 이름만으로 기기 성공을 보증하지 않는다.

이미지/레이아웃/웹 focus/history action은 이 native adapter의 capability가 아니다. arbitrary shell, W3C execute script, WebView context 전환, TV도 제공하지 않는다. [Appium command 문서](https://appium.io/docs/en/latest/reference/api/appium/), [WebDriver protocol](https://appium.io/docs/en/latest/reference/api/webdriver/), [Android attributes](https://github.com/appium/appium-uiautomator2-driver#element-attributes), [iOS attributes](https://appium.github.io/appium-xcuitest-driver/latest/reference/element-attributes/)에서 native 의미를 확인했다.

## 실제 기기 인수 절차

다음은 **실행 예정 절차**이며 이 환경에서 실제 기기로 통과한 기록이 아니다. 사용자 앱의 ID/selector/기대값을 mobile-smoke.json 또는 XML에 작성한다. 추천 최소 Flow는 start → launch → input → assertValue → tap → assertVisible → screenshot → end다. 앱이 지원하는 별도 Flow로 mobileBack/hideKeyboard도 확인한다. TC platform 역시 실행 플랫폼과 맞춘다.

준비된 Android 호스트에서 명령을 실행해 정확한 기기와 driver를 확인한다.

```powershell
adb devices -l
appium --version
appium driver list --installed
appium driver doctor uiautomator2
```

준비된 Mac 호스트에서는 Xcode/실기기 또는 simulator UDID를 확인한다.

```sh
xcodebuild -version
xcrun simctl list devices available
xcrun xctrace list devices
appium driver list --installed
appium driver doctor xcuitest
```

Appium 서버를 별도 터미널에서 준비한 뒤, alpha.4 CLI 통합본에서 명시한 config로 실행한다.

```powershell
aqa validate mobile-smoke.xml --json
aqa plan mobile-smoke.xml --json
aqa run mobile-smoke.xml --appium-config appium.android.local.json --json --diagnostics stderr --report artifacts/mobile-android
aqa run mobile-smoke-ios.xml --appium-config appium.ios.local.json --json --diagnostics stderr --report artifacts/mobile-ios
```

성공 Flow와 expected를 의도적으로 바꾼 실패 Flow를 각각 실행한다. 취소는 `--control-stdin`을 추가하고 stdin에 UTF-8 `{"type":"cancel"}` 한 줄을 전달한다. 각 실행의 result.json, events.jsonl, evidence.json, 실제 PNG 및 SHA-256과 서버의 세션 삭제를 확인한다. 기록에는 device OS/앱 build/UDID 식별 정책/Appium 및 driver 버전/PASS·FAIL·cancel outcome을 남긴다. 실기기 task는 이 증거 확보 후에만 완료한다.

## 오류와 제한

element missing/mismatch와 step deadline TIMEOUT은 failed, 지원하지 않는 동작은 blocked, transport/session 실패는 infra_error다. 남은 시간이 0 이하면 요청 전 거부하며 input의 clear가 시간을 소진하면 value 요청을 보내지 않는다. 세션 deadline은 TIMEOUT/session, 별도 requestTimeoutMs cap 초과는 SESSION_ERROR다. driver의 raw message/stacktrace/응답 본문은 public 오류에 복사하지 않는다. secretRef가 하나라도 있는 core 실행 또는 이 adapter가 secret input을 처리한 경우 screenshot HTTP 요청부터 생략한다. Appium 서버 자체 로그의 비밀값 보관 정책은 서버 운영자가 따로 관리한다.

일반 JSON 응답은 1MiB, screenshot JSON은 14MiB, decoded PNG는 10MiB/16,777,216 pixels까지다. PNG signature/IHDR/chunk 경계/IDAT/IEND를 확인한다. 이미지 전체 CRC나 디코딩 의미는 이 adapter에서 검증하지 않는다. core가 저장 파일 hash를 계산한다.

endSession은 진행 중 HTTP 요청을 중단하고 알려진 session ID의 DELETE를 최대 4초 내 시도한다. 세션 생성 응답을 받기 전에 연결이 끊기면 서버가 만든 ID를 알 수 없어 해당 세션의 DELETE를 보장할 수 없다. 유한 newCommandTimeout을 설정하며, 이 값은 **서버가 명령 처리를 끝내고 idle 상태가 된 뒤** 적용된다. 실행 중 driver 명령 자체의 중단/서버 프로세스 종료를 보장하지 않는다. 삭제 실패는 cleanup 오류이며 성공으로 숨기지 않는다.

## 검증 기록

2026-10-31: `node --test tests/appium.test.mjs`에서 로컬 fake W3C 서버를 이용한 **22/22 PASS, skipped 0**. Android/iOS 요청 payload, exact assertion 및 expectedRef, wait 상태, 모호 selector, URL segment encoding, PNG/secret, unsupported, invalid JSON/body cap/redirect, timeout/cancel/DELETE와 만료된 step의 추가 입력 방지를 확인했다. 이는 실제 장치 또는 실제 Appium driver 인수가 아니다.

`npx --no-install openspec validate qa-appium-adapter --strict --no-interactive` PASS. 전체 Engine schema/CLI/package consumer 인수는 통합 담당자가 별도로 수행한다.

`npx --no-install tsc --noEmit --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck false runners/appium/adapter.d.ts` PASS. core 공개 타입의 bytes를 Uint8Array로 바꾼 Engine 담당자 수정 이후 Node 전용 ambient Buffer 타입 없이 확인했다. Appium 담당자가 core/schema/CLI/package 파일을 수정하지 않았다.
