# Design

## Context

현재 XML parser/serializer와 template CLI가 존재한다. 임의 입력 export가 없고 JSON CDATA 요소를 object로 받으면 unknown XML child를 무시할 수 있다. baseline specs는 아직 없고 qa-ai-blueprint active change의 입력 의미를 유지한다.

현재 package.json에는 bin/files가 있으나 exports 진입점이 없다. executeBlueprint는 이미 adapter, AbortSignal, onEvent를 주입받는다. 이 구조를 공개 API로 정리하며 새 앱 모노레포나 별도 서버를 Engine에 만들지 않는다.

## Goals / Non-Goals

**Goals:** 동일 정본 schema와 XML 투영으로 사용자 정의 Flow 배포, 엄격 parsing, 실제 CLI 왕복/실행, 명시적인 alpha.2 pin, 외부 프로젝트가 설치해 재사용하는 공개 core/adapter API.

**Non-Goals:** 별도 XML 실행 schema, 웹/Flutter 구현, 임의 script 실행, 중앙 registry/Agent/공급자 CLI 내장.

## Decisions

- XML 구조는 기존 blueprint/flow/nodes/edges와 CDATA JSON을 유지한다. JSON으로만 배포하는 대안은 사용자의 XML 요구를 충족하지 못한다.
- export FILE --format xml [--out FILE]는 기존 load/compile 경계를 재사용하고 출력 파일은 wx로 생성한다. schema/graph 검증과 XML 재파싱 동등성을 확인한 뒤 출력한다.
- JSON payload 요소는 문자열만 받고 child/attribute/중복 배열을 거부한다. 정본의 선택적 문자열/숫자 필드를 truthy 검사로 누락하지 않는다. 복합형은 기존 schema에 맡긴다.
- 관리 결정: engineVersion은 alpha.2로 증분하고 contractVersion draft.1 및 schemaVersion v1은 유지한다. 기존 alpha.1 bundle은 보존한다.
- 공개 bundle과 별도 XML fixture/hash metadata를 build-contract 생성·drift 검사에 포함한다. Checker는 공개 artifact만 복사/소비하며 Engine private 소스를 복사하지 않는다.
- Checker 웹은 사용자의 블록/Flow/편집된 Blueprint를 Engine 공개 XML 규격으로 직렬화하고 Engine CLI 왕복 contract test로 의미 동등성을 검증한다. fixture 다운로드 전용이 아니며 지원되는 임의 action/selector/target 조합을 배포한다. Desktop은 CLI import/validate/plan/run을 소비한다.
- Engine가 XML을 파싱·검증·정규화하여 plan을 생성하고 adapter로 웹을 직접 제어한다. 현재는 Playwright(web)를 실제 제공하고 Appium(Android/iOS)은 후속이다. XML은 Appium 자체 명령 형식이 아니다.
- 단일 npm package에 core와 별도 adapter export를 둔다. 지금 여러 npm package로 분리하는 대안은 버전/배포 비용만 늘리므로 채택하지 않는다. core는 Playwright 구체 클래스에 의존하지 않으며 consumer가 adapter를 주입한다.
- public root API는 `parseSource`, `loadBlueprint`, `validateSchema`, `compileBlueprint`, `executeBlueprint`, `QaError`, `ENGINE_VERSION`을 제공한다. adapter는 `automated-qa-engine/playwright`에서 `PlaywrightAdapter`를 제공한다. XML export는 CLI로 제공하고 라이브러리 공개 범위는 문서화된 exports로 제한한다.
- root 및 adapter 패키지를 import하는 것만으로 browser/session/child process를 시작하지 않는다. 실제 자원 생성은 명시적 실행 요청 뒤에만 수행한다. public API의 `.d.ts`와 타입 문서를 배포하여 TypeScript consumer가 검증/plan/실행 options·events·results를 확인할 수 있게 한다. 독립 설치 consumer의 typecheck로 선언과 exports 해석을 검증한다.
- `executeBlueprint(blueprint, {adapter, reportDir, timeoutMs, headless, signal, secretResolver, allowProduction, onEvent})`를 공개한다. `AbortController.abort()`는 취소이고 awaited `onEvent`는 ordered versioned 이벤트 전달이다. 결과는 `{result, reportDir, plan}`이며 입력 오류는 안정된 QaError.code로 거부한다. callback 실패를 통과로 처리하지 않는 경계를 문서·테스트로 확인한다.
- 배포 인수는 npm pack tgz를 sibling source 없는 임시 consumer 프로젝트에 설치하고 package 이름 import 및 설치된 aqa bin을 사용한다. 직접 상대경로 import나 source 디렉터리를 dependency로 넣는 방식은 인수로 인정하지 않는다. 실제 브라우저 PASS/FAIL, cancel, event 순서와 result schema, screenshot/hash를 검증한다.
- CLI 버전/bundle engineVersion/manifest/tgz version을 alpha.2로 맞추고 SHA-256 및 npm integrity를 기록한다. 외부 consumer 예제에는 Playwright browser 사전 설치와 지원 Node 버전을 명시한다. private local-preview는 npm registry publish를 뜻하지 않는다.

## Risks / Trade-offs

- XML 문법과 JSON type 중복 → JSON CDATA를 그대로 정본 schema로 검증한다.
- runtime와 기존 tgz 식별 혼동 → alpha.2 버전 및 새 pack hash를 공개하고 alpha.1 archive를 보존한다.
- XML 특수문자/빈 문자열/CDATA 분할 손실 → 사용자 변경 fixture와 round-trip equality 검증을 추가한다.
- Windows 강제 process kill은 graceful cancel과 다름 → Desktop lifecycle 인수는 Checker 담당 검증으로 구분한다.
- onEvent callback 오류/consumer 종료는 엔진 정상 완료가 아님 → API 오류 경계를 실제 검증하고 결과를 가짜 성공으로 반환하지 않는다. CLI 전체 프로세스의 OS 강제 종료 복구는 이번 라이브러리 취소 보장과 구분한다.

## Migration Plan

기존 alpha.1 입력을 그대로 지원한다. 새 bundle/fixture hash 및 CLI tgz를 Engine에서 검증한 뒤 Checker pin을 갱신한다. 원격 publish/commit/push는 하지 않는다.

## Review State

2026-10-29 관리 에이전트가 양쪽 OpenSpec를 검토한 뒤 적용 업무를 재할당했다. XML/패키지 API/타입과 alpha.2 local-preview 산출물을 구현하고 전체 39개 tests 및 독립 tgz 소비 인수를 통과했다. 기준 spec sync/archive와 Checker pin 갱신은 이번 작업에서 하지 않았다.

검증 보강: TypeScript 6.0.3은 devDependency로만 고정했다. onEvent 실패 후 callback을 중단하고 durable events/result를 계속 기록하며, callback 무응답은 run deadline/AbortSignal로 제한한다. terminal 전달은 불변 result 저장 이후 1초 제한이며 실패 시 API만 ENGINE_ERROR로 reject한다. 실패 evidence는 3초, session cleanup은 5초로 제한하며 원래 assertion 판정을 보존한다.
