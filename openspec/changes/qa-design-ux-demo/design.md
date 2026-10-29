# Design

## Context

이 문서는 **미구현 공개 계약 초안**이다. Engine `0.1.0-alpha.2`, schema 계약 `0.1.0-draft.1` 및 기존 tgz/bundle/hash는 그대로 유지한다. 아래 action·필드·CLI는 현 배포물에 없다. 차기 runtime/contract 버전은 구현 인수 때 고정한다. Checker counterpart는 `automated-qa-checker/openspec/changes/qa-design-ux-demo`이며 현재 pin을 자동 변경하지 않는다.

현재 `packages/core/compiler.mjs`는 선언형 action whitelist와 웹 capability를 검증한다. `runners/playwright/adapter.mjs`의 tap은 click, input은 fill이며 assertion은 visible/text/value다. PNG 증거 수집은 있지만 비교 기능은 없다. `packages/core/runner.mjs`는 screenshot artifact와 bounded observer/cleanup을 제공한다. `contracts/schemas/qa.schema.json`에는 profile/reference/측정 보고서가 없으며 XML은 `packages/core/documents.mjs`와 `xml.mjs`가 정규화한다. 기존 screenshot 단계 성공만으로 이미지 비교 성공을 판단할 수 없다.

## Goals / Non-Goals

목표는 외부 패키지 소비자가 제공한 PNG·명시 수치와 실제 웹을 비교하고, 사용자 binding으로 기본 UX XML을 생성·실행하는 기능 데모다. 이미지 차이, 수치 차이, 행동 결과를 독립 판정한다. 사용자 임의 지원 selector/target 조합을 허용하며 고정 예제 전용이 아니다.

직접 Figma API/인증, 서버, 검사 도구 자체 UI 품질 개선, 고급 편집 UI, Appium 구현, OS 키보드 및 모바일 system back은 제외한다. Figma 등 도구 export/connector와 사용자 입력 UI는 Checker 또는 외부 도구 책임이다. XML에 arbitrary JS/shell을 추가하지 않는다.

## Decisions

### Public draft: inputs, output and ownership

Engine이 아래 필드 의미와 schema를 소유한다. 이름의 `/v1`은 초안 식별자이며 배포 버전 승인이 아니다. Checker는 별도 실행 schema를 만들지 않고 공개 bundle/schema를 소비한다.

| 최소 문서 | 초안 필드와 기능 |
| --- | --- |
| `qa.designReference/v1` | `id`, `profile`, `images[]`의 id/path/sha256/region/threshold, `measurementRules[]`의 id/selectorId/metric/expected/tolerance/source. PNG와 명시 수치 출처·mapping의 정본. |
| `qa.checkPreset/v1` | `id`, 정확한 `version`, `requiredCapabilities`, `inputBindings`, 선언형 `template`. 실행 가능한 일반 Blueprint로 전개하기 위한 로컬 템플릿만 포함. |
| `qa.checkReport/v1` | `nodeId`, `kind(image/layout/ux)`, `verdict`, 안정된 `reason`, reference/profile hash, expected/actual/tolerance와 artifactRefs. 별도 서버 상태나 실행 결과를 중복 소유하지 않는 검사 증거. |

Blueprint에는 명시 `references` 및 `target.profile` 참조를 추가하고 XML에서도 전용 요소의 JSON CDATA로 동등하게 보존하는 안을 채택한다. `flow.metadata.presentation`에 실행 의미를 숨기지 않는다. profile/binding/rule에 알 수 없는 필드·단위·action은 거부한다. JSON↔XML roundtrip, 검증·계획 hash, 공개 타입이 같은 의미를 유지해야 한다.

신규 action 후보는 `assertImage`, `assertLayout`, `assertInViewport`, `assertHitTarget`, `assertFocused`, `assertUrl`, `browserBack`이다. 세부 params는 reference/rule/selector id를 참조하며 arbitrary expressions를 받지 않는다. compiler가 웹 capability와 params를 검증하고 browserBack을 side-effect retry 제한에 포함한다. 미지원 target은 실행 전 거부한다.

CLI 초안은 `aqa preset list`, `aqa preset expand <id> --version <version> --bindings <file> --out <file>` 및 리소스를 읽는 기존 명령의 `--reference-root <directory>`다. import/export/validate/plan/run 흐름을 재사용한다. preset 목록·전개·import는 브라우저를 시작하지 않는다. library는 같은 동작과 `.d.ts`를 제공하며 import 부작용 없음 계약을 유지한다. 별도 임의 스크립트 실행 CLI는 추가하지 않는다.

### Reference and comparable profile

첫 단위는 로컬 디렉터리 리소스이며 archive 자동 해제·원격 다운로드는 없다. 상대 path만 허용하고 realpath 기준 root containment, symlink 탈출 방지, SHA-256 재검증을 적용한다. PNG는 최대 파일 10 MiB, decode 후 16,777,216 pixels로 제한하는 초안을 채택한다. JSON/XML은 기존 입력 크기/depth 제한을 유지한다.

profile은 viewport width/height(CSS px), DPR, browser/build 및 실행 OS 식별, locale/colorScheme, 요구 font 이름과 제공 font asset hash, readiness selector/timeout을 포함한다. local font가 실제 사용됨을 확인할 수 없거나 필수 profile이 관측과 다르면 비교불가다. 준비는 명시 selector와 `document.fonts.ready`를 한정된 시간 안에 확인하며 무기한 network-idle을 요구하지 않는다. 환경별 baseline이 필요하다. font 고정만으로 다른 OS rasterization 동등성을 주장하지 않는다.

이미지 영역은 viewport 전체 또는 명시 CSS 좌표 사각형이다. capture 전 auto-scroll하지 않는다. CSS 사각형 경계 각각에 DPR을 곱해 반올림한 pixel 경계를 사용한다. 예상 PNG 크기와 다르면 blocked이며 resize하지 않는다. Figma export 배율이나 frame id는 출처 정보이며 CSS 기대치를 raster에서 추론하지 않는다. 실행 중 baseline 덮어쓰기/자동 승인도 없다.

### Image and numeric judgments

PNG는 sRGB RGBA로 해석하고 투명도는 명시 흰 배경으로 합성한다. 다른 색상 profile은 지원 범위 확인 전 blocked다. pixel 차이는 RGB channel 최대 절대 차이가 `channelTolerance`(0..255)를 초과하면 1로 센다. `diffRatio = changedPixels / comparedPixels`가 `maxDiffRatio`(0..1) 이하이면 passed다. threshold는 필수이며 암묵적으로 완화하지 않는다. 비교 영역 0 pixels는 거부한다. baseline/actual/diff를 별도 hash와 함께 남긴다. 초기에는 perceptual AI/OCR/자동 mask가 없다. secret 보호로 screenshot이 생략되면 비교는 blocked다.

수치 whitelist는 viewport 기준 `bbox.x/y/width/height`, `gap.horizontal = B.left - A.right`, `gap.vertical = B.top - A.bottom`, computed `font-size`다. 모든 값과 절대 tolerance는 CSS px이며 음수 gap은 겹침을 뜻한다. 각 rule은 기대값 출처(사용자 입력/도구 export 문서 식별과 해당 JSON hash)를 명시한다. `abs(actual - expected) <= tolerance`로 판단한다. selector는 기존 testId/text/role/css를 재사용하며 한 요소로 해석되어야 한다. 미발견은 기대 요소 부재 failed, 다중 매칭은 binding 진단 blocked다. 관측은 scroll/fill/click 없이 수행한다.

### UX presets and bounded coverage

기본 `web-input` preset은 launch/readiness → assertInViewport → assertHitTarget → tap → assertFocused → input → assertValue다. 기대 입력은 사용자 binding이며 secret은 기존 secretRef로만 전달한다. focus 검증 전에 fill하지 않는다. input은 기존 fill 의미이며 실제 타이핑/IME/키보드 출현을 검증한 것으로 표현하지 않는다.

viewport assertion은 요소 bbox가 viewport에 포함되는지 확인한다. hit-target은 중심과 경계 안쪽 네 점에서 elementFromPoint가 대상 또는 자손인지를 관측한다. 포인터를 받지 않는 시각 overlay, 부분 가림, 모든 transform/곡선 영역을 완전 보장하지 않는다. iframe 내부/canvas/닫힌 shadow root 검사는 첫 단위 미지원이다. pure observation 이후 페이지 변화에 의한 race는 tap 단계 실패로 따로 보고한다.

`web-history-back` preset은 사용자가 명시한 두 allowed launch target 이동으로 history를 만든 뒤 browserBack → assertUrl(정확 일치) → assertVisible(expected screen) 순서다. 뒤로가기 button 클릭이나 모바일 system back과 혼용하지 않는다. history가 없으면 blocked, 기대 화면 차이는 failed다. preset 선택·정확 버전/hash·필수 binding 없이 실행하지 않는다. coverage는 매핑된 입력·경로에 한정되며 앱 전체 기본 검사 완료를 뜻하지 않는다. 첫 실패 후 중단하는 기존 Flow 정책과 순차 Suite를 유지한다.

### Results, lifecycle and compatibility

비교 가능한 차이는 `failed`, profile/크기 불일치·미지원은 `blocked`, 지원 검사에서 browser disconnect/수집 실패는 `infra_error`, 명시 취소는 `cancelled`다. 입력 단계 거부는 기존 CLI validation error이며 실행되지 않은 run result를 꾸며내지 않는다. 최초 검사 실패 후 보조 증거 수집 실패는 최초 결과를 보존하고 sanitized 수집 진단을 추가한다.

기존 screenshot artifact 형태는 유지하며 JSON check-report artifact variant와 png role(baseline/actual/diff) 참조를 차기 계약에 추가한다. 파일명은 run output 내부의 평탄한 안전 이름으로 제한하고 JSON/PNG 각각 contentType, sha256, size를 기록한다. `events.jsonl`과 `result.json` 기존 위치·이벤트 순서는 유지하며 step/result가 보고서를 연결한다. 민감 입력·callback 원문 오류를 보고서에 넣지 않는다.

adapter typed observation을 core runner가 검증·저장하도록 확장하며 adapter에서 임의 출력 경로를 쓰지 않는다. 각 작업은 남은 run deadline/AbortSignal 안에서 수행한다. PNG decode/비교는 중단 가능한 worker 또는 cooperative chunk로 구현하고 timeout 후 session 누수를 남기지 않는다. observer 실패 후 durable events, terminal observer 최대 1초, 실패 증거 최대 3초, session cleanup 최대 5초인 기존 경계를 유지한다. 새로운 작업이 callback/cancel 예산을 우회해서는 안 된다.

## Risks / Trade-offs

- 브라우저·font·OS 변화는 픽셀 차이를 만들 수 있다. profile/hash 고정과 blocked를 사용하고 threshold 자동 완화는 하지 않는다.
- click/fill은 결함을 숨길 수 있다. 순수 관측과 focus assertion을 앞세운다. [Playwright actionability](https://playwright.dev/docs/actionability)의 보장과 별개로 정의한다.
- 큰/손상 PNG 및 동기 CPU 작업은 timeout을 막을 수 있다. 제한·decoder 검증·worker 취소 회귀를 인수한다. 이미지 decoder 의존성 선택·정확 pin은 apply 초기 검토 후 고정한다.
- 기본 check pack은 좁은 coverage다. [브라우저 emulation](https://playwright.dev/docs/emulation)은 실제 OS 키보드/모바일 back 증거가 아니다.

## Migration Plan

Engine 공개 draft 관리 검토 → schema/actions/API 구현 및 계약 테스트 → 외부 tgz 소비 실제 Chromium 인수 → 새 runtime/contract/bundle/XML/preset hash 고정 → Checker pin을 별도 관리 결정으로 갱신한다. 기존 alpha.2 artifact는 덮어쓰지 않는다. 기존 XML에는 신규 필드를 강제하지 않으며 회귀 검증한다. rollback은 기존 버전 pin이며 새 검사 결과를 구버전 지원으로 표시하지 않는다.

## Open Questions

제품 동작은 위 초안으로 고정하여 리뷰한다. 차기 배포 버전 및 PNG decoder 의존성의 정확 버전은 아직 배포하지 않았으므로 pending이다. apply 전 관리 검토에서 공개 계약과 dependency pin을 승인·기록한다. 이 계획 작성 자체는 구현 완료나 Checker pin 변경을 의미하지 않는다.
