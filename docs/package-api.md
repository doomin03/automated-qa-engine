# 독립 Engine 패키지 API

현재 alpha.10 소스/후보는 execution contract 0.3.0-draft.2, 별도 document authoring contract 0.1.0-draft.1이다. [listTemplates/createTemplate/composeBlueprint](document-authoring.md), 독립 API/CLI, optional Agent, 디자인·UX/Appium, [bounded authoring·DOM capture](authoring.md)를 제공한다. 최종 설치 인수/hash는 버전별 검증 기록을 확인한다. 기존 공개 API와 ExecuteOptions/ActionContext 계약은 유지한다. [디자인·UX](design-checks.md), [Appium](appium.md)의 지원·제약을 따른다.

Node 24.18.0 이상 25 미만, ESM. `automated-qa-engine@0.1.0-alpha.10`는 로컬 tgz preview다. 원격 npm publish는 하지 않았다. Flow/TC/selector/target/result는 Engine JSON Schema v1, bundle 계약은 0.3.0-draft.2다. alpha.2–9 고정 원본과 서버 alpha.6 pin은 보존한다.

```powershell
npm install ./automated-qa-engine-0.1.0-alpha.10.tgz --ignore-scripts
npx --no-install playwright install chromium
npx --no-install aqa doctor --json
npx --no-install aqa run my-test.xml --json --report artifacts
```

core 또는 `automated-qa-engine/playwright`를 import하는 것만으로 브라우저 설치·session·child process를 시작하지 않는다. 검증/계획 생성에도 브라우저가 필요 없다. 실제 실행은 `executeBlueprint` 또는 CLI run/run-suite/demo로 명시한다.

Windows child pipe 제어는 alpha.3 CLI의 `--control-stdin --diagnostics stderr`를 사용한다. UTF-8 `{"type":"cancel"}\n` 입력 후 cancelled result/terminal/exit5를 확인한다. 빈 EOF는 무동작이며 자세한 입력 한도와 오류 정책은 [CLI 사용법](../packages/cli/README.md)을 따른다. API 자체의 signal/onEvent 계약은 유지하고 CLI만 취소 뒤 누락 event를 durable JSONL에서 검증·출력한다.

## 공개 진입점

alpha.8의 내부 domain/codec/runtime 및 Agent state/service 분리는 공개 export를 추가하거나 private 모듈 경로를 소비 계약으로 만들지 않는다. core는 구체 adapter/CLI/Agent를 import하지 않는다. CLI schema/validate/plan의 문서 경로도 adapter를 지연 로드하는 실행 경로와 분리한다. 기존 오류 순서와 run/node deadline·취소·result/artifact 불변성은 alpha.7과 같다.

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

`ExecuteOptions`: adapter, reportDir(default artifacts), timeoutMs(default 60000, 1..300000), headless(default true), signal, secretResolver, allowProduction(default false), referenceRoot, onEvent. secretResolver는 동기 함수 `(reference) => string | undefined`이며 누락은 SECRET_NOT_FOUND다. OS 전체 process kill은 AbortSignal의 graceful 취소와 다르다.

core는 구체 browser를 알지 않는다. adapter는 getCapabilities/startSession/performAction/evaluateAssertion/captureEvidence/endSession과 선택 capture를 제공한다. Playwright adapter는 web, Appium adapter는 Android/iOS protocol을 지원하며 한 실행에 새 인스턴스를 사용한다. Appium 실기기는 미검증, TV는 미지원이다.

alpha.7의 Web/Appium assertText/assertValue는 하나의 node 예산 안에서 기대값을 기다린다. mismatch의 ASSERTION_FAILED와 먼저 만료된 node/run TIMEOUT을 구분하며 모두 failed다. retry로 deadline을 늘리지 않는다. Playwright 중복 start는 거부하고 endSession은 진행 중인 launch와 합류해 browser를 닫는다. Appium 생성 요청 후 ID 또는 DELETE 미확증은 CLEANUP_ERROR이며 cancelled 결과라도 cleanup confirmed가 아니다.

Flow 한도는1000노드/2000edge, result의 visited/unvisited는 각각1000이다. 공개 artifact는 실행당256개이며 check report의 PNG들과 JSON도 각각 센다. 초과 수집은 ENGINE_ERROR/infra_error로 종료하면서 기존 manifest/hash와 result를 보존한다. cleanupErrors도256개로 집약하지만 CLEANUP_ERROR는 보존한다. 구 draft.1 소비자는 큰 결과를 거부할 수 있으므로 draft.2 bundle pin으로 함께 갱신해야 한다.

loadBlueprint/readDocument의 documentRoot 옵션과 CLI --document-root는 최초 문서 및 TC/Suite/selector/target 참조의 realpath containment를 적용한다. 미지정 시 기존 상대 경로를 유지한다. 일반 문서와 secrets-file/Appium 설정은 regular file에서 최대 1MiB+1 byte만 읽고 초과를 거부한다. secrets-file은 256개 이하 문자열 값의 JSON object이며 기본 env secret 지원은 유지한다.

screenshot.params.required는 기본 false다. 수집 불가/오류이면 optional step은 skipped(전체는 passed 가능), required는 정책상 불가 blocked 또는 수집오류 infra_error다. step.skipped는 terminal outcome이 아니다. captureEvidence 옵션은 containsSecrets, signal, timeoutMs이며 adapter는 예약된 staging 파일만 쓴다. runner가 bytes를 검증하여 별도 확정 PNG를 저장한 뒤 manifest에 추가한다. 늦은 custom adapter 쓰기는 확정 artifact 및 불변 result를 변경하지 못하지만 미등록 staging 파일을 남길 수 있다.

## 오류와 이벤트 경계

입력/정책/secret 오류는 session 시작 전 QaError로 reject한다. 실행 도중 assertion 실패는 failed, driver 문제는 infra_error, 취소는 cancelled result로 반환하며 자원 정리 후 기록한다. artifact 파일을 쓸 수 없는 경우에는 I/O 오류로 reject할 수 있으므로 API 호출 성공과 테스트 passed를 구분한다.

실패 증거 수집은 독립 3초, session cleanup은 5초 제한이다. 증거 수집 실패/무응답은 EVIDENCE_ERROR로 기록하며 원래 assertion 판정을 덮어쓰지 않는다. custom adapter는 자체 I/O 취소·정리 책임을 지며 Engine은 해결되지 않은 consumer/adapter Promise 자체를 강제로 종료할 수 없다.

실행 중 onEvent는 순서대로 await하며 run timeout과 AbortSignal을 공유한다. alpha.7에서 내부 run deadline 소진은 TIMEOUT/run → failed이고 callback 자체 reject는 ENGINE_ERROR/infra_error다. 응답 없는 실행 중 callback도 run budget이 소진되면 TIMEOUT으로 분류한다. 실제로 중단된 callback의 후속 전달은 끄며 durable events/result와 cleanup은 계속한다. callback의 원문 오류/비밀값은 기록하지 않는다. 취소가 먼저 관측되면 CANCELLED를 보존한다. 이미 중단된 callback은 API 반환과 events.jsonl로 종결 상태를 확인한다.

alpha.10은 이미 확정된 실패의 step.finished에 독립 최대1초 전달 예산을 적용한다. 정상 취소/timeout 자체가 callback을 실패시키지 않으므로 건강한 observer는 실패 정리와 terminal을 받으며 인위적인 ENGINE_ERROR가 없다. 실패 정리 callback 자체 reject/미응답이면 alpha.3부터의 정책대로 최초 failure/outcome을 보존하고 cleanupErrors에 sanitized ENGINE_ERROR(phase cleanup)를 추가하며 후속 callback은 끈다. 정리 전달 중 추가 AbortSignal은 최초 판정을 바꾸거나 이 별도 예산을 중단하지 않는다. adapter.endSession 실패의 CLEANUP_ERROR는 별도이며 Agent unknown 정책을 유지한다. alpha.9까지 정상 취소에서도 전달 진단과 terminal 미수신이 발생할 수 있었다. 파일 저장 실패와 동기 event-loop 점유까지 해결하는 보장은 아니다.

run.finished는 불변 result를 저장한 뒤 기록한다. 이 terminal callback만 실패하면 이미 저장된 테스트 판정을 수정하지 않고 API가 QaError ENGINE_ERROR(phase run)로 reject한다. callback 시간 제한은 이 단계에서 1초다. 소비자는 이를 전달 실패로 취급하고 결과 디렉터리의 result/events를 조회한다. consumer 코드가 event loop를 동기적으로 무한 점유하는 경우에는 같은 process에서 timeout을 강제할 수 없다.

event identity는 `(runId, attempt, sequence)`다. callback 실패 이후에도 JSONL에는 순서대로 기록한다. `run.finished.resultPath`는 실행 디렉터리 기준 `result.json`; 경로는 `<report>/<runId>/`다. 검증되지 않은 경로나 outcome을 신뢰하지 말고 공개 schema로 읽는다.

## TypeScript

공개 root/adapter exports는 `.d.ts`를 포함한다. Blueprint/Flow/ExecutionPlan/RunEvent/RunResult 등은 정본 schema에서 생성하고 drift 검사한다. API options와 RunnerAdapter는 선언 파일로 제공한다. NodeNext ESM consumer를 지원하며 ES2022 및 AbortSignal 타입이 필요하다. 예제는 `examples/consumer.mjs`다.

타입은 runtime schema 검증을 대신하지 않는다. 문자열 길이·ID pattern·DAG·origin allowlist 및 schema의 의미 제약은 parse/validate/compile에서 검사한다. JSON으로 읽은 값은 unknown으로 받아 검증하며, private 파일 경로 import는 public API에 포함하지 않는다.
