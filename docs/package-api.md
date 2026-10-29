# 독립 Engine 패키지 API

Node 24.18.0 이상 25 미만, ESM. `automated-qa-engine@0.1.0-alpha.2`는 로컬 tgz로 배포하는 preview다. 원격 npm publish는 하지 않았다. Flow/TC/selector/target/result는 Engine JSON Schema v1, bundle 계약 버전은 0.1.0-draft.1이다.

```powershell
npm install ./automated-qa-engine-0.1.0-alpha.2.tgz --ignore-scripts
npx --no-install playwright install chromium
npx --no-install aqa doctor --json
npx --no-install aqa run my-test.xml --json --report artifacts
```

core 또는 `automated-qa-engine/playwright`를 import하는 것만으로 브라우저 설치·session·child process를 시작하지 않는다. 검증/계획 생성에도 브라우저가 필요 없다. 실제 실행은 `executeBlueprint` 또는 CLI run/run-suite/demo로 명시한다.

## 공개 진입점

```javascript
import { loadBlueprint, compileBlueprint, executeBlueprint, QaError } from 'automated-qa-engine';
import { PlaywrightAdapter } from 'automated-qa-engine/playwright';

const blueprint = await loadBlueprint('./my-test.xml');
const plan = compileBlueprint(blueprint);
console.log(plan.requiredActions);
const controller = new AbortController();
try {
  const output = await executeBlueprint(blueprint, {
    adapter: new PlaywrightAdapter(),
    reportDir: './artifacts',
    signal: controller.signal,
    onEvent: event => { console.log(event.type, event.sequence); },
  });
  console.log(output.result.outcome, output.reportDir);
} catch (error) {
  if (error instanceof QaError) console.error(error.code, error.message);
  else throw error;
}
// 실행 중 외부 UI/서비스의 취소 요청은 controller.abort()로 전달한다.
```

| API | 입력/반환 |
| --- | --- |
| parseSource(text, format='json') | JSON/YAML/XML 문자열 → 스키마 검증된 교환 객체. graph 검증은 compile 단계다. |
| loadBlueprint(file, options?) | 파일 → Promise Blueprint. 단독 Flow/TC는 options.selectors/targetManifest 파일 경로 필요. |
| validateSchema(document) | 교환 객체 → 동일 객체, 자료형/필드/schemaVersion 검사. |
| compileBlueprint(document) | Blueprint → 깊게 동결된 ExecutionPlan; graph/selector/target/capability/secret 참조 검사. |
| executeBlueprint(document, options) | Blueprint → Promise `{result, reportDir, plan}`. adapter 필수. |
| QaError | 안정된 code/message/phase/details. 실제 secret이 있는 원본 driver/callback 오류를 노출하지 않는다. |
| ENGINE_VERSION | 정확한 runtime 버전 문자열. |

`ExecuteOptions`: adapter, reportDir(default artifacts), timeoutMs(default 60000, 1..300000), headless(default true), signal, secretResolver, allowProduction(default false), onEvent. secretResolver는 동기 함수 `(reference) => string | undefined`이며 누락은 SECRET_NOT_FOUND다. OS 전체 process kill은 AbortSignal의 graceful 취소와 다르다.

core는 구체 browser를 알지 않는다. adapter는 getCapabilities/startSession/performAction/evaluateAssertion/captureEvidence/endSession을 제공한다. 현재 Playwright adapter는 web만 지원하며 한 실행에 새 인스턴스를 사용한다. Appium/TV adapter는 미구현이다.

## 오류와 이벤트 경계

입력/정책/secret 오류는 session 시작 전 QaError로 reject한다. 실행 도중 assertion 실패는 failed, driver 문제는 infra_error, 취소는 cancelled result로 반환하며 자원 정리 후 기록한다. artifact 파일을 쓸 수 없는 경우에는 I/O 오류로 reject할 수 있으므로 API 호출 성공과 테스트 passed를 구분한다.

실패 증거 수집은 독립 3초, session cleanup은 5초 제한이다. 증거 수집 실패/무응답은 EVIDENCE_ERROR로 기록하며 원래 assertion 판정을 덮어쓰지 않는다. custom adapter는 자체 I/O 취소·정리 책임을 지며 Engine은 해결되지 않은 consumer/adapter Promise 자체를 강제로 종료할 수 없다.

onEvent는 순서대로 await하며 run timeout과 AbortSignal을 공유한다. callback이 reject하거나 남은 시간 안에 끝나지 않으면 ENGINE_ERROR/infra_error로 실행을 중단하고 callback 전달을 끈 뒤 durable events/result와 cleanup은 계속한다. callback의 원문 오류/비밀값은 기록하지 않는다. 취소로 전달이 중단된 경우 callback에서 terminal을 받는 대신 API 반환과 events.jsonl로 확인한다.

run.finished는 불변 result를 저장한 뒤 기록한다. 이 terminal callback만 실패하면 이미 저장된 테스트 판정을 수정하지 않고 API가 QaError ENGINE_ERROR(phase run)로 reject한다. callback 시간 제한은 이 단계에서 1초다. 소비자는 이를 전달 실패로 취급하고 결과 디렉터리의 result/events를 조회한다. consumer 코드가 event loop를 동기적으로 무한 점유하는 경우에는 같은 process에서 timeout을 강제할 수 없다.

event identity는 `(runId, attempt, sequence)`다. callback 실패 이후에도 JSONL에는 순서대로 기록한다. `run.finished.resultPath`는 실행 디렉터리 기준 `result.json`; 경로는 `<report>/<runId>/`다. 검증되지 않은 경로나 outcome을 신뢰하지 말고 공개 schema로 읽는다.

## TypeScript

공개 root/adapter exports는 `.d.ts`를 포함한다. Blueprint/Flow/ExecutionPlan/RunEvent/RunResult 등은 정본 schema에서 생성하고 drift 검사한다. API options와 RunnerAdapter는 선언 파일로 제공한다. NodeNext ESM consumer를 지원하며 ES2022 및 AbortSignal 타입이 필요하다. 예제는 `examples/consumer.mjs`다.

타입은 runtime schema 검증을 대신하지 않는다. 문자열 길이·ID pattern·DAG·origin allowlist 및 schema의 의미 제약은 parse/validate/compile에서 검사한다. JSON으로 읽은 값은 unknown으로 받아 검증하며, private 파일 경로 import는 public API에 포함하지 않는다.
