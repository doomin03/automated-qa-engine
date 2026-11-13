# automated-qa-engine

**alpha.10 / contract 0.3.0-draft.2**는 독립 API/CLI와 선택적으로 시작하는 [Agent](docs/agent.md)를 제공하는 로컬 preview다. [재사용 템플릿·XML/JSON 조합](docs/document-authoring.md)은 별도 authoring contract 0.1.0-draft.1을 사용한다. PNG 기준 비교, CSS 수치·UX, versioned preset, Android/iOS Appium protocol과 [유한 반복 XML·공개 DOM 값 캡처](docs/authoring.md)를 지원한다. [디자인·UX 사용법](docs/design-checks.md), [Appium 설정과 미검증 실기기 범위](docs/appium.md)를 참고한다. 이전 고정 배포와 alpha.6 서버·alpha.8 Release는 보존하며 정확한 최종 설치 인수/hash는 버전별 검증 기록을 따른다.

기능 중심의 로컬 preview. JSON/YAML/XML Blueprint를 검증하고 Playwright 또는 Appium adapter로 QA를 실행한다. 실제 Chromium 인수와 Appium protocol 인수를 구분하며, Android/iOS 실기기는 별도 검증이 필요하다. Checker가 없어도 다른 Node 프로젝트에서 공개 API/CLI로 사용한다.

## 다른 프로젝트에서 사용

버전별 검증 기록의 `automated-qa-engine-0.1.0-alpha.10.tgz`를 설치하고 웹 실행용 브라우저를 준비한다.

```powershell
npm install ./automated-qa-engine-0.1.0-alpha.10.tgz --ignore-scripts
npx --no-install playwright install chromium
npx --no-install aqa run my-test.xml --json --report artifacts
```

라이브러리는 `automated-qa-engine`의 compileBlueprint/executeBlueprint 등과 `automated-qa-engine/playwright`의 PlaywrightAdapter를 import한다. [공개 API와 타입](docs/package-api.md), [소비 예제](examples/consumer.mjs)를 참고한다.

## 소스 저장소 개발

Node 24.18.0 / npm 11.16.0 기준, 이 저장소 루트에서 실행한다.

```powershell
npm ci --ignore-scripts
npx --no-install playwright install chromium
npm run demo
npm run verify
```

demo는 로컬 웹 서버를 열고 성공 1회·의도적 실패 1회를 실제 실행한다. 각 실행의 blueprint.json, events.jsonl, result.json, evidence.json 및 스크린샷을 artifacts/run_… 아래에 저장한다.

## AI CLI / 수동 실행

```powershell
node packages/cli/aqa.mjs schema
node packages/cli/aqa.mjs template --format xml --out example.xml
node packages/cli/aqa.mjs import example.xml --out example.qa.json
node packages/cli/aqa.mjs export example.qa.json --format xml --out shared.xml
node packages/cli/aqa.mjs validate example.qa.json
node packages/cli/aqa.mjs plan example.qa.json
```

예제 파일은 별도 터미널에서 node examples/server.mjs를 실행한 뒤 다음으로 수행한다.

```powershell
node packages/cli/aqa.mjs run examples/login.qa.json --json --report artifacts
```

기계가 stdout을 읽을 때는 npm 배너가 섞이지 않도록 직접 node 명령 또는 설치된 aqa bin을 사용한다.
[AI 입력 정책](docs/ai-authoring.md), [XML 규격](docs/xml-format.md), [공개 API](docs/package-api.md)를 참고한다.

## 구현 범위

- 스키마·DAG·selector·target·secretRef 검사, bounded retry/timeout/cancel, branch.
- launch/tap/input/clear/waitFor/assertVisible/assertText/assertValue/screenshot.
- 시각 비교·layout·focus·가림·web history 검사, preset/유한 반복 전개와 공개 DOM 값 capture.
- schema/template/import/export/validate/plan/run/run-suite/devices/doctor/demo, preset/expand, templates/compose, optional agent.
- 단일 Node ESM 런타임. core, Playwright, Appium adapter는 별도 공개 진입점이다.
- Agent는 서버와 로컬 허용 정책의 교집합, 순차 case 실행, lease 취소, durable outbox/reconcile을 사용한다. 이전 실행의 자동 재실행이나 불명확한 기기의 자동 재배정은 하지 않는다.
- 현재 execution contract bundle: contracts/releases/qa-contract-0.1.0-alpha.10.json; SHA-256은 contracts/release.json. 작성 contract는 contracts/authoring-release.json으로 별도 고정한다. 공개 XML fixture/hash는 contracts/xml-release.json. Agent HTTP pin은 contracts/agent-protocol/pin.json으로 별도 관리한다.

원격 npm 게시를 하지 않은 로컬 tgz preview다. Agent의 실제 Checker 서버·독립 CLI/Chromium 통합 인수는 alpha.6의 이력이다. alpha.7 이후 버전은 별도 설치와 HTTP fixture로 인수하며 서버/운영 Agent alpha.6 pin을 자동 변경하지 않는다. Checker Desktop의 source/default pin·Windows Release 전환과 인수는 해당 저장소에서 별도로 관리한다. Appium 실기기 검증과 TV는 완료 범위에 포함하지 않는다. Blueprint 하나는 한 target/session을 사용하며 다중 앱·서버 간 비교 실행과 raw Suite XML은 지원하지 않는다. Checker 사용자 웹은 공용 시나리오 배포·진행 확인, Flutter Desktop은 개별 테스트 개발·실제 실행을 담당한다. Checker의 권한·게시·예약과 UI 전체 인수 상태는 해당 저장소에서 관리한다.

## alpha.1 → alpha.2

schemaVersion v1과 contract 0.1.0-draft.1 및 기존 입력을 유지한다. alpha.2는 사용자 Blueprint XML export, 엄격 XML 입력 검증, 독립 패키지 API/타입을 추가한다. alpha.1 tgz에는 새 export/API가 없으며 기존 alpha.1 bundle은 보존한다. runtime/tgz는 정확한 alpha.2 버전, 교환 artifact는 각 SHA-256으로 고정한다. [XML 공개 규격](docs/xml-format.md)을 참고한다.

내부 기획·개발 검증 기록은 소스 저장소 docs/에 보관하며 배포 패키지는 공개 사용 문서만 포함한다.

## alpha.6 → alpha.7

서비스 CLI는 무관한 flag/추가 positional을 거부하고 출력 정체를 별도 writer에 격리한다. 소비자는 stdout/stderr를 읽고 stdin cancel을 사용한다. 강제 process kill은 자손 정리를 보장하지 않는다. [CLI 운영 계약](packages/cli/README.md)을 따른다.

contract draft.2는 최대1000노드 Flow의 결과 목록 한도를 정합한다. artifact256 한도 초과도 유효 결과를 남긴다. 값 단언은 node 예산 안에서 비동기 갱신을 기다리며, callback 대기의 내부 run 만료는 TIMEOUT/failed다. Appium 생성/삭제 미확증은 CLEANUP_ERROR와 Agent quarantine으로 남긴다. Agent journal v2는 ACK 이력을 압축하되 pending/tombstone을 보존하며 같은 state의 구버전 downgrade는 지원하지 않는다.

## alpha.7 → alpha.8

공개 API·타입·CLI·DSL·오류·event 순서와 schema bytes를 유지하면서 내부 책임을 나눴다. 문서 명령은 구체 adapter를 로드하지 않고, core의 입력/계획/실행/증거 저장, adapter의 session/동작, 선택 Agent의 실행/복구/저장을 구분한다. package 이름·bin·공개 진입점은 그대로다. 이 버전은 독립 설치 인수 대상 로컬 preview이며 Checker 기본 버전과 운영 state를 자동으로 승격하거나 변경하지 않는다.

## alpha.8 → alpha.9

실행 schema와 Agent HTTP 바이트는 유지하고 별도 작성 계약에 네 기술 템플릿과 단일 target XML/JSON 조합을 추가한다. sourceMap은 기존 Checker namespace와 분기 label을 보존한다. 생성은 검증된 Blueprint/XML을 반환하며 실제 run은 명시 요청이다. [작성 계약과 CLI](docs/document-authoring.md)를 따른다.

## alpha.9 → alpha.10

실패 정리 이벤트에 별도 최대1초 전달 예산을 적용해 정상 취소·run timeout 자체가 건강한 API callback을 실패시키지 않도록 한다. 실제 callback 장애의 진단, 최초 판정, adapter cleanup 및 CLI replay는 유지한다. 실행·작성·Agent schema는 동일하며 authoring bundle은 runtime을 포함한 새 파일명을 authoring-release.json의 artifact로 안내한다. 기존 alpha.9 아카이브와 작성 bundle은 보존한다. 서버/Agent와 Desktop의 통합 pin 승격 및 다른 PC 배포 검증은 관리 인수 뒤 별도로 진행한다.

## alpha.2 → alpha.3


기존 schema v1/contract draft.1 입력을 유지하며 실패 처리 중 observer 오류의 결과 누락을 수정한다. CLI는 명시 `--control-stdin` 취소와 `--diagnostics stderr`를 제공한다. Windows Desktop은 stdin에 UTF-8 `{"type":"cancel"}\n`을 보내고 cancelled terminal/result 및 exit5를 확인한다. 기본 오류 stdout은 호환 유지한다. [설치·명령·제어 규격](packages/cli/README.md)을 참고한다. 기존 alpha.2 tgz/bundle/XML은 보존하며 새 package 이름은 alpha.3이다. 소스 Git 게시와 원격 npm package publish는 별개다.

