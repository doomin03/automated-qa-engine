# 제한된 반복 작성 문서

이 기능은 **alpha.5 / contract 0.3.0-draft.1**에 추가된다. alpha.4 공개 입력 규격과 구분하며 최종 설치 인수/hash는 alpha.5 검증 기록을 따른다.

작성 문서는 반복 원본을 보관하고, 실행기는 반복을 펼친 표준 Blueprint를 실행한다. AI CLI 또는 GUI는 같은 authoring 문서를 만들 수 있다. 임의 코드나 runtime loop를 실행하지 않는다.

## 입력 형태

루트는 `schemaVersion`과 `blueprint` 두 필드다. blueprint는 기존 qa.blueprint/v1 형태이며 flow.nodes에서 다음 repeat 노드를 추가로 허용한다.

```json
{
  "id": "check-three-times",
  "type": "repeat",
  "count": 3,
  "steps": [
    {
      "id": "click",
      "type": "action",
      "action": "tap",
      "params": { "selector": "submit" }
    },
    {
      "id": "visible",
      "type": "assertion",
      "action": "assertVisible",
      "params": { "selector": "submit" }
    }
  ]
}
```

외부 edges는 `start → check-three-times → end`처럼 repeat의 ID를 참조한다. repeat.steps 배열 순서대로 한 번 실행하고 이 순서를 count만큼 펼친다. 기존 outer branch의 true/false 경로도 repeat를 가리킬 수 있다. 반복 내부의 branch/start/end/다른 repeat는 이번 규격에서 지원하지 않는다.

count는 정수 1..100이다. 각 repeat의 steps는 비어 있지 않아야 하며 해당 repeat 안의 step ID는 유일해야 한다. 서로 다른 repeat는 같은 step ID를 사용할 수 있다. ID는 영문자로 시작하는 128자 이하의 영문·숫자·밑줄·점·하이픈이다. repeat 자체에는 timeout/retry를 넣지 않는다. 기존 action/assertion step의 timeout/retry는 각 생성 노드에 보존된다. 부작용 재시도에는 기존 allowSideEffects 정책이 그대로 적용된다.

## API와 XML

공개 API는 다음 세 함수다. 아래 예시는 alpha.5의 package root export를 사용한다.

```js
import { readFile, writeFile } from 'node:fs/promises';
import {
  parseAuthoringSource,
  expandAuthoring,
  authoringXml,
  executeBlueprint,
} from 'automated-qa-engine';
import { PlaywrightAdapter } from 'automated-qa-engine/playwright';

const source = parseAuthoringSource(
  await readFile('repeated.authoring.xml', 'utf8'),
  'xml',
);
const { blueprint, sourceMap } = expandAuthoring(source);
await writeFile('source-map.json', JSON.stringify(sourceMap, null, 2));
await writeFile('copy.authoring.xml', authoringXml(source));
const { result } = await executeBlueprint(blueprint, {
  adapter: new PlaywrightAdapter(),
  reportDir: 'artifacts/repeated',
});
console.log(result.outcome);
```

`parseAuthoringSource(text, format='json')`은 json/yaml/yml/xml을 받으며 유효한 immutable authoring 객체를 반환한다. `expandAuthoring(document)`은 검증된 immutable `{blueprint,sourceMap}`을 반환한다. 반환한 실행 정의를 수정하려면 먼저 `structuredClone`한다. 입력 객체는 변경하지 않는다. `authoringXml(document)`은 동일 작성 정의를 교환하는 XML을 반환한다.

XML은 다음 형태다. 이 예제는 저장소 demo 웹의 username 입력이 보이는지 세 번 확인한다. 실행 전에 demo 서버가 4317 포트에서 준비되어 있어야 한다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<authoring schemaVersion="qa.authoring/v1">
  <blueprint><![CDATA[
    {
      "schemaVersion": "qa.blueprint/v1",
      "id": "repeat-demo",
      "flow": {
        "schemaVersion": "qa.flow/v1", "id": "repeat-flow", "entryNode": "start",
        "nodes": [
          { "id": "start", "type": "start" },
          { "id": "open", "type": "action", "action": "launch", "params": { "target": "app" } },
          { "id": "checks", "type": "repeat", "count": 3, "steps": [
            { "id": "visible", "type": "assertion", "action": "assertVisible", "params": { "selector": "username" } }
          ] },
          { "id": "end", "type": "end" }
        ],
        "edges": [ { "from": "start", "to": "open" }, { "from": "open", "to": "checks" }, { "from": "checks", "to": "end" } ]
      },
      "selectors": {
        "schemaVersion": "qa.selectors/v1", "id": "repeat-selectors",
        "selectors": { "username": { "web": { "strategy": "testId", "value": "username" } } }
      },
      "target": {
        "schemaVersion": "qa.target/v1", "id": "repeat-target", "platform": "web", "environment": "local",
        "launchTargets": { "app": "http://127.0.0.1:4317" }, "allowedOrigins": [ "http://127.0.0.1:4317" ]
      }
    }
  ]]></blueprint>
</authoring>
```

파일 생성은 `authoringXml`을 사용할 수 있다. 작성 XML `<authoring>`와 실행 XML `<blueprint>`는 다른 문서다. 펼친 Blueprint를 기존 XML exporter로 변환한 결과는 일반 실행 XML이다. 작성 XML을 기존 Blueprint parser에 바로 넣지 않는다.

CDATA 안의 `]]>`는 분리된 CDATA로 안전하게 왕복한다. `&entity;`처럼 보이는 문자열도 CDATA 안에서는 입력 데이터다. CDATA 밖 DTD/entity 및 unknown/중복 element/attribute는 거부한다. payload는 단일 blueprint element의 CDATA JSON이어야 한다. shell, JavaScript, XML entity로 명령을 확장하지 않는다.

## 진행 상황 대응표

생성 node ID는 `repeat_` 뒤에 SHA-256 64자리가 붙는다. hash 입력은 JSON 배열 `[repeat.id, iteration, step.id]`이며 iteration은 1부터 시작한다. 원본 ID와 iteration이 같으면 동일 ID다. 주변 배열 순서를 바꿔도 해당 반복 노드의 ID는 바뀌지 않는다. 기존 top-level ID 또는 다른 생성 ID와 충돌하면 자동 이름 변경 없이 INVALID_FLOW로 거부한다.

```json
{
  "schemaVersion": "qa.authoringSourceMap/v1",
  "authoringHash": "sha256:<64 hex>",
  "blueprintSnapshotHash": "sha256:<64 hex>",
  "nodes": [
    { "nodeId": "start", "sourceNodeId": "start" },
    {
      "nodeId": "repeat_<64 hex>",
      "sourceNodeId": "check-three-times",
      "sourceStepId": "click",
      "iteration": 1
    }
  ]
}
```

이 예시의 hash는 설명용이며 실제 함수는 완전한 64자리 hash를 반환한다. nodes 배열은 확장 Blueprint의 flow.nodes 순서다. 일반 노드는 nodeId/sourceNodeId만 있고 반복 노드는 sourceStepId/iteration이 추가된다.

GUI는 event.nodeId로 이 대응표를 조회해 “check-three-times · 2회차 · click”처럼 표시할 수 있다. sourceMap을 실행 입력에 섞지 않는다. authoringHash는 원본 canonical JSON, blueprintSnapshotHash는 실행 Blueprint canonical JSON의 SHA-256이다. 원본/실행 파일과 sidecar를 함께 보관하고 hash가 일치하는지 확인한다.

runId/attempt/sequence 및 nodeId의 event identity 규칙은 유지된다. 실행 snapshot과 result는 확장 Blueprint 기준이다. 반복 중 assertion이 실패하면 이후 반복과 노드는 기존 first-failure 정책에 따라 unvisited로 남는다.

## 한도와 오류

| 항목 | 한도/정책 |
| --- | --- |
| 원본 text 및 직접 API 객체의 JSON 표현 | UTF-8 1MiB |
| 확장 Blueprint | compact JSON UTF-8 1MiB |
| repeat count | 정수 1..100 |
| 확장 nodes / edges | 1000 / 2000 |
| JSON 깊이 | 128 미만 |
| YAML | duplicate keys·recursive alias 거부, maxAliasCount 20 |
| 객체 값 | plain JSON, finite number; cycle/getter/function/symbol/예약 key 거부 |
| body 구조 | action/assertion만, nested repeat/branch 미지원 |

count와 확장 노드 수를 먼저 확인하고, 복제할 JSON 크기를 합산한 뒤 본문을 복제한다. 작은 원본이라도 펼친 입력이 1MiB를 넘으면 거부한다. 외부 edge는 원본 top-level node만 가리켜야 하며 step 또는 생성 ID로 반복 중간에 진입할 수 없다. 최종 결과도 공통 compileBlueprint의 selector/target/secret/graph/retry 검증을 통과해야 한다.

잘못된 모양/수치/크기는 INVALID_DOCUMENT, 충돌·잘못된 연결은 INVALID_FLOW, 미지원 body 구조는 UNSUPPORTED_CAPABILITY다. 사용자가 제공한 문자열을 실행 코드로 해석하지 않는다.

## 검증 기록

2026-10-31: `node --test tests/authoring.test.mjs` **18/18 PASS, skipped 0**. JSON/YAML/XML 동일성, count 1/100, deterministic ID, outer branch/다중 incoming/연속 repeat, 충돌/잘못된 graph, 1MiB·depth·예약 key/XML 방어, 문서 예제 유효성, 실패 후 unvisited를 검증했다. `npx --no-install openspec validate qa-bounded-authoring --strict --no-interactive`도 PASS다.

실제 Chromium에서 작성 XML → 확장 Blueprint XML → 버튼 3회 클릭 → 최종 값 3 확인 → PNG 수집을 통과했다. 생성 반복 노드 6개와 전체 11개 step의 ID가 유일하고 event.sequence가 연속이며 result snapshot hash가 sourceMap과 일치했다.

- evidence root: `C:/Users/Domin/AppData/Local/Temp/aqa-authoring-browser-Q5EEki`
- runId: `run_b25b2d98-c675-4f97-a8bc-4199bb173f95`
- PNG SHA-256: `2184ee3e2ecfe99746b2641713b44975f52b6f63f5a57f8bbd0ca3986912d551`
- 저장 문서: source.authoring.xml, expanded.blueprint.xml, source-map.json 및 run별 result.json/events.jsonl/evidence.json/PNG.

alpha.5에서 정확히 1000개 node의 확장 성공과 1001개 거부를 검증했다. 이는 1000개 브라우저 조작을 실제 실행했다는 뜻은 아니다. 설치 패키지·CLI 소비 증거는 최종 alpha.5 인수 기록을 따른다.

## CLI와 원본 보관

```powershell
aqa expand source.authoring.xml --out expanded.xml --document-root .
aqa validate expanded.xml
aqa run expanded.xml --json --report artifacts
```

expand는 실행하지 않는다. 기본 XML 출력과 함께 `expanded.xml.source-map.json`, `expanded.xml.authoring.xml`을 저장한다. 원본은 입력 bytes 그대로이며 `--source-map`, `--source-out`으로 경로를 지정할 수 있다. `--format json`은 실행 Blueprint JSON을 출력한다. JSON/YAML 원본도 지원한다. 출력은 exclusive write로 기존 파일을 덮어쓰지 않으며 여러 파일 쓰기의 OS 오류는 부분 파일을 남길 수 있다. run은 authoring 문서를 자동 실행하지 않고 확장된 Blueprint를 받는다.

## 공개 DOM 값 캡처

변수 선언 `{ "captured": { "from": "capture", "public": true } }`와 `captureValue` 또는 `captureText` action의 `{ "selector": "alias", "variable": "captured" }`를 사용한다. 이후 input.valueRef, assertValue.expectedRef, branch.condition.variable에서 참조할 수 있다. 모든 도달 경로에서 캡처가 선행해야 compile이 성공한다. 반복 본문의 캡처도 확장된 DAG에서 같은 검사를 받는다. 재캡처를 시작할 때 이전 값을 지우므로 실패 후 이전 값으로 진행하지 않는다.

captureValue는 input/textarea/select 값, captureText는 보이는 DOM text node를 순서대로 연결한 문자열이다. 공백 정규화나 innerText와 완전한 동일성을 보장하지 않는다. 문자열 16,384자, DOM 방문 10,000개, ancestor 128개를 제한하고 browser 경계 밖으로 내보내기 전에 검사한다. iframe/canvas/shadow-root 내부는 지원하지 않는다.

password input, autocomplete current-password/new-password/one-time-code, data-qa-sensitive 표시가 자신·조상·검사한 하위 DOM에 있으면 blocked다. secret 변수가 있는 flow와 capture의 혼합도 거부한다. public:true는 작성자의 명시 신뢰 선언이며 전화번호·주소·이름 등 모든 개인정보를 자동 탐지한다는 뜻이 아니다. 캡처 실패 시 자동 PNG를 생략하고 원문 값은 events/result/snapshot/진단에 넣지 않는다. 성공한 public 캡처 화면의 명시 screenshot은 공개 값이 보일 수 있다. custom adapter는 신뢰 코드다.
