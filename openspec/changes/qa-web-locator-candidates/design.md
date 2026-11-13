# Design

## Context

원본 Stage6은 recording→Flow 초안과 locator 후보를 후속 기능으로 구분한다. 현재 runners/playwright/locator.mjs는 testId/css/text/role seed를 해석하고 session.mjs는 origin route/새 context/cleanup join을 소유한다. 기존 작성 템플릿은 이미 알려진 selector를 입력받으므로 이번 후보 수집과 역할이 다르다.

alpha.10 후보는 동결 상태다. 이 명세는 alpha.11용 설계일 뿐이며 관리 apply 전 package/exports/schema/CLI 코드를 바꾸지 않는다.

## Goals / Non-Goals

**Goals:** 한 요소에 대한 제한된 locator 후보를 기존 실행 DSL 문법으로 제공하고, 실제 현재 페이지에서 고유성과 동일성을 검증한다.

**Non-Goals:** recorder 완성, 사용자 브라우저/쿠키 attach, 인증정보/DOM 전체/입력값/innerText/스크린샷 수집, arbitrary JS, 클릭·입력·QA action 실행, Flow 파일 덮기, 모바일/iframe/shadow/canvas 검사, selector 장기 안정성 보장.

## Decisions

### D1. 기존 실행 계층과 분리

공개 `automated-qa-engine/web-tools`의 inspectWebLocatorCandidates(request, options)를 제안한다. packages/web-tools 조립 계층이 schema/target 정책과 구체 browser session을 연결한다. core 또는 adapter에서 조립 계층으로 역참조하지 않는다. 순수 후보 생성은 별도 내부 함수로 검사하고 실제 관측/수명과 분리한다. dependency gate에 이 계층의 허용 경로와 역방향 금지를 추가한다. 단순 module import는 프로세스/브라우저/네트워크를 시작하지 않는다.

### D2. 입력과 출력 draft

request는 `{schemaVersion:'qa.locatorInspection/v1', target, launchAlias, seed}`이다. target은 기존 qa.target/v1 중 web만, profile은 최초 범위에서 거부한다. launchAlias는 target.launchTargets의 키, seed는 기존 web selector(testId/css/text/role)다. QA Flow나 실행 결과를 생성할 필요가 없으며 기존 action을 숨겨 실행하지 않는다.

options는 `{timeoutMs,signal,headless,allowProduction}`이며 기본30000ms, 범위1..60000ms다. production은 명시 opt-in 없으면 거부한다. 기존 exact allowedOrigins/URL userinfo 거부 정책을 재사용한다. input size1MiB, 문자열 seed/속성 최대1024 UTF-16 code units, 출력64KiB, 후보 최대2개, diagnostics 최대8개다. direct API getter/toJSON/hidden/symbol/prototype/cycle를 기존 safe input 정책으로 거부한다.

성공 반환은 `{schemaVersion:'qa.locatorCandidates/v1', locatorContractVersion:'0.1.0-draft.1', status:'inspected', observedAt, source:{targetId,launchAlias,origin}, candidates:[{kind:'testId'|'idCss',selector,unique:true,sameElement:true}], diagnostics:[{code,message}]}`다. 전체 URL/query/seed 원문은 반사하지 않는다. candidates는 testId, idCss 순서로 결정적이며 observedAt만 관측시각이다. 후보0개도 검사가 완료됐으면 inspected이며 NOT_ENOUGH_STABLE_ATTRIBUTES 또는 AMBIGUOUS_CANDIDATE 등 진단을 제공한다. inspected는 QA passed/outcome이 아니다.

### D3. 관측과 고유성

새 headless context에서 launch URL로 한 번 이동하고 DOMContentLoaded 후 seed가 유일하게 붙어있는 visible 요소인지 유한 대기한다. main document의 light DOM만 허용한다. iframe/shadow/canvas 또는 password/one-time-code 민감 입력 요소는 UNSUPPORTED_CAPABILITY로 명확히 거부한다. seed가0이면 기존 ELEMENT_NOT_FOUND로 거부한다. 여러 개면 기존 UNSUPPORTED_CAPABILITY로 거부하고 details에 값 없는 AMBIGUOUS_SELECTOR 진단을 제공한다. AMBIGUOUS_SELECTOR는 이 도구의 진단 식별자이며 새 실행 오류 enum이나 QA outcome이 아니다.

해당 요소의 data-testid/id 두 속성만 browser realm 안에서 길이 제한하여 읽는다. 입력값·접근성 이름·본문·HTML·다른 요소속성을 수집하지 않는다. 속성도 개인/비밀정보일 수 있으므로 값의 안전성을 일반 보장하지 않으며 사용자는 허가한 페이지에만 실행한다. password/OTP 감지는 모든 민감정보 검출기라는 의미가 아니다.

CSS id는 CSS.escape에 해당하는 올바른 식별자 escaping을 사용한다. 후보마다 현재 matches를 최대2개까지만 관측해 고유성을 확인하고 동일 element handle을 가리키는지 검사한다. 중복/다른요소/관측 중 detach는 후보에서 제외하고 구체 값 없는 진단을 남긴다. text/role/위치/nth-child/XPath 자동 후보는 첫 단위에서 생성하지 않는다. 검수 후 별도 Blueprint 작성에 적용해야 한다.

### D4. 페이지 접근과 수명

navigation은 실제 페이지 script/요청을 실행한다. 도구가 클릭/입력을 하지 않는다고 무부작용이라 표현하지 않는다. 기존 origin route, service worker/download 차단, WebSocket 차단을 적용하고 off-origin redirect를 거부한다. 운영 opt-in은 요청발행 권한을 대체하지 않는다.

하나의 전체 timeout/cancel 예산을 launch/navigation/seed/후보 검증에 공유한다. finally에서 startup join과 최대5초 cleanup을 수행한다. 이미 취소/실패했으면 원래 QaError를 보존하고 cleanup 불확증은 sanitized 진단으로 전달한다. 성공 관측 뒤 cleanup 실패는 성공 inspected 반환 대신 CLEANUP_ERROR로 reject한다. 동기 무한 user callback 문제는 새 callback API를 제공하지 않아 늘리지 않는다. 브라우저 강제 kill의 완전한 자손 정리는 보장하지 않는다.

### D5. CLI와 패키지

`aqa inspect-locators INPUT --json [--timeout MS] [--headed|--headless] [--allow-production] [--out FILE] [--document-root DIR] [--diagnostics stderr]`를 제안한다. 명시적 browser 검사 명령이며 기본 stdout JSON 한 개, --out이면 exclusive 파일에 envelope를 쓰고 성공 stdout은 비운다. input regular/bounded/UTF8와 document-root/realpath, out wx 규칙은 작성 CLI와 공유한다. 오류는 기존 JSON code/exit 채널을 따르되 이 명령에는 QA run events/result를 합성하지 않는다. API AbortSignal/timeout은 지원하고 CLI 별도 stdin control은 이 첫 조회 명령에 추가하지 않는다. CLI 사용자는 timeout과 소유 프로세스 정책을 사용한다.

실행/작성/Agent schema bytes 불변, 별도 locator schema/bundle의 정확한 version/hash를 배포한다. filename은 runtime을 포함하여 alpha.10 이하를 덮지 않는다. public type/파일 manifest와 독립 npm bin 검증을 포함한다.

## Risks / Trade-offs

- testId/id가 없는 요소는 추천0개다 → 불안정한 자동 nth-child로 성공을 가장하지 않고 명시 진단을 준다.
- seed를 이미 알아야 한다 → 첫 단위는 개발자가 임시 CSS/text로 선택한 요소를 안정된 후보로 정리하는 도구다. GUI click picker/recorder는 별도 후속이다.
- DOM 변경은 관측 뒤에도 일어난다 → 현재 시점 검증만 주장하고 사용자 검수·실행 전 기존 validation을 유지한다.
- navigation에서 앱 부작용이 생길 수 있다 → production/origin 정책과 명시 호출을 요구하고 자동 백그라운드 수집하지 않는다.

## Migration Plan

관리 명세 검토·alpha.10 Checker 인수 완료→별도 apply 승인→집중 실제 Chromium→전체회귀→alpha.11 독립 설치/계약 gate 순서다. 이 명세 작성만으로 alpha.11 기능을 광고하거나 기존 pin을 바꾸지 않는다.
