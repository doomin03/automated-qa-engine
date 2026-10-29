# automated-qa-engine

기능 중심의 로컬 preview **0.1.0-alpha.2**. JSON/YAML/XML Blueprint를 검증하고 실제 Chromium에서 QA를 실행한다. 다른 Node 프로젝트가 공개 API 또는 CLI로 소비할 수 있는 독립 패키지다.

## 다른 프로젝트에서 사용

검증된 `automated-qa-engine-0.1.0-alpha.2.tgz`를 설치하고 브라우저를 준비한다.

```powershell
npm install ./automated-qa-engine-0.1.0-alpha.2.tgz --ignore-scripts
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
- schema/template/import/validate/plan/run/run-suite/devices/doctor/demo.
- 단일 Node ESM 런타임. core와 Playwright adapter는 별도 공개 진입점이다.
- contract bundle: contracts/releases/qa-contract-0.1.0-alpha.2.json; SHA-256은 contracts/release.json. 공개 XML fixture/hash는 contracts/xml-release.json.

로컬 preview이며 npm/GitHub에 게시하지 않았다. Appium/TV/원격 Agent/idempotent 서버 실행은 후속 단계다. Checker 사용자 웹은 공용 시나리오 배포·진행 확인, Flutter Desktop은 개별 테스트 개발·실제 실행을 담당한다. Checker 통합 인수 상태는 해당 저장소에서 관리한다.

## alpha.1 → alpha.2

schemaVersion v1과 contract 0.1.0-draft.1 및 기존 입력을 유지한다. alpha.2는 사용자 Blueprint XML export, 엄격 XML 입력 검증, 독립 패키지 API/타입을 추가한다. alpha.1 tgz에는 새 export/API가 없으며 기존 alpha.1 bundle은 보존한다. runtime/tgz는 정확한 alpha.2 버전, 교환 artifact는 각 SHA-256으로 고정한다. [XML 공개 규격](docs/xml-format.md)을 참고한다.

내부 기획·개발 검증 기록은 소스 저장소 docs/에 보관하며 배포 패키지는 공개 사용 문서만 포함한다.

