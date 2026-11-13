# 재사용 문서 작성 API와 CLI

alpha.9에서 도입한 기술 템플릿과 XML/JSON 블록 조합은 alpha.10에서도 같은 작성 schema/catalog를 사용합니다. 실행 계약 `0.3.0-draft.2`와 별도로 authoring contract `0.1.0-draft.1`을 사용합니다. 생성 성공은 QA 실행 성공이 아닙니다. `run`은 사용자가 별도로 요청합니다. 기존 서버와 Desktop Release를 자동 전환하지 않습니다.

`contracts/authoring-release.json`의 artifact 필드가 bundle 파일명의 정본이고 sha256은 그 정확한 바이트 hash입니다. 소비자는 artifact가 안전한 단일 상대 파일명인지 확인한 뒤 package의 contracts/releases 안에서 읽습니다. alpha.9는 `qa-authoring-0.1.0-draft.1.json`, alpha.10은 `qa-authoring-0.1.0-draft.1-engine-0.1.0-alpha.10.json`을 사용해 이전 파일을 덮지 않습니다. 파일명을 contractVersion만으로 조합하지 않습니다. 이 bundle은 작성 JSON Schema, catalog와 실행 schema SHA를 담습니다. 실행 schema는 `contracts/schemas/qa.schema.json`, 작성 schema는 `contracts/schemas/qa-authoring.schema.json`입니다. 두 schema를 AJV에 등록하면 catalog의 외부 target/selectors `$ref`도 검증할 수 있습니다.

```sh
aqa templates list --json
aqa templates show web-input-check --template-version 1.0.0
aqa templates create web-input-check --template-version 1.0.0 --template-sha256 CATALOG_SHA --bindings bindings.json --out authored.json
aqa compose composition.json --out composed.json --document-root .
```

`CATALOG_SHA`는 사용자가 선택한 template의 실제 catalog 값입니다. 실행 예제가 아닌 자리 표시자이며 그대로 사용하면 실패합니다. `--out`은 JSON 응답 파일 하나를 새로 생성하고 기존 파일을 덮어쓰지 않습니다. 생략하면 stdout에 동일 JSON을 출력합니다. 오류/exit/`--diagnostics stderr`는 기존 CLI 계약을 따릅니다. 원문과 결과 경로를 같게 지정하면 거부합니다.

| Template | 필수 bindings | 생성 순서 |
| --- | --- | --- |
| empty | id, target | start→end. 아직 검사 동작이 없으며 compose에는 넣을 수 없습니다. |
| web-open-click | id, target, selectors, launch, selector | launch→waitFor→tap |
| web-input-check | 위 항목과 value | launch→waitFor→input→assertValue |
| native-open-check | id, target, selectors, launch, selector | launch→assertVisible |

target/selectors는 기존 Blueprint 형식, launch는 target.launchTargets의 alias입니다. web template은 web, native는 android/ios입니다. native 설정에 endpoint/udid/provider를 넣지 않습니다. 그것은 실제 실행 시 로컬 설정입니다. 기기 연결/실기기 동작 검증을 template 지원 정보에서 추정하면 안 됩니다. value는 문자열 또는 `{ "secretRef": "사용자가_관리하는_참조" }`입니다. secretRef는 from:secret/valueRef/expectedRef만 생성하며 비밀을 읽지 않습니다. literal로 넣은 비밀을 자동 발견·삭제하는 기능은 없습니다.

```js
import {listTemplates, createTemplate, composeBlueprint, compileBlueprint} from 'automated-qa-engine';
const catalog = listTemplates();
const template = catalog.templates.find(t => t.id === 'empty');
// target is an explicitly supplied, valid execution target manifest.
const authored = createTemplate({templateId: template.id, version: template.version,
  sha256: template.sha256, bindings: {id: 'my-scenario', target}});
const plan = compileBlueprint(authored.blueprint); // no execution
```

`composeBlueprint` 입력은 `schemaVersion: 'qa.composition/v1'`, `assets: [{id,format,source,sha256}]`, `instances: [{id,assetId}]`, `links: [{from,to}]`입니다. source는 XML/JSON 문자열이고 sha256은 정확한 UTF-8 raw hex hash입니다. sourceFile/include/URL/좌표/undo는 입력 필드가 아닙니다. Engine이 파일이나 URL을 따라 읽지 않습니다. 원문을 직접 parse/compile하므로 prevalidated 플래그를 전달할 수 없습니다.

출력 `qa.authoredBlueprint/v1`에는 blueprint, xml, blueprintSnapshotHash, flowSnapshotHash, template, sourceMap, diagnostics가 있습니다. 성공 diagnostics는 빈 배열입니다. template 생성의 sourceMap은 null, compose의 template은 null입니다. 작성 객체는 독립 불변 snapshot이며 수정하려면 복제하여 새로 검증합니다. 컴파일 snapshot hash는 `sha256:` 접두사 형식이고 raw source/template/bundle SHA와 구분합니다.

sourceMap.nodes의 키는 생성 node ID이며 값은 instanceId/assetId/sourceNodeId/sourceHash입니다. 기존 Dart와 같은 `b_` + SHA256(instanceId/kind/originalId)의 앞 24 hex를 사용합니다. 원본 start/end는 제거되고 composition_start/end는 syntheticNodes로 구분됩니다. Checker는 assetId로 sourceFile/좌표를 UI에서 보강합니다. 다른 snapshot의 map으로 실행 이벤트를 표시하면 안 됩니다.

outer는 단일 순차 chain, 내부는 기존 DAG, target 전체 값은 동일해야 합니다. reference/profile/testCase/preset 합성은 지원하지 않습니다. 자산은 시작/종료 각 하나와 내부 노드가 필요합니다. input envelope 1 MiB, assets/instances 64개, output nodes 1000/edges 2000, Blueprint와 XML 각각 1 MiB, 응답 4 MiB입니다. 임의 getter/toJSON, cycle, reserved key 등 JSON이 아닌 직접 API 객체를 거부합니다.

오류는 기존 QaError code와 `details.diagnostics`의 code/path(JSON Pointer)/message 및 선택 assetId/instanceId/sourceNodeId로 식별합니다. 진단은 최대 64개이며 첫 검사 단계에서 중단할 수 있습니다. 원문/값/절대 경로를 메시지로 덤프하지 않습니다. 생성 도중 실패하면 부분 실행 문서를 반환하지 않습니다.

CLI 입력은 1 MiB까지 regular file로 읽습니다. `--document-root`를 지정하면 input 및 output parent의 realpath가 내부여야 하고 symlink/junction/상위 경로 탈출을 거부합니다. root를 생략하면 명시한 로컬 경로를 허용하므로 OS sandbox가 아닙니다. 다른 프로세스의 동시 디렉터리 교체까지 격리하지 않습니다. API 작성은 실행 취소와 무관하며 브라우저/Appium/네트워크/secret resolver를 시작하지 않습니다. CLI transport는 stdout/stderr writer child를 사용할 수 있습니다.

반복 작성은 기존 `expand`, UX 가림/focus 검사는 기존 `preset`으로 구분합니다. 기존 `template` 로그인 데모 명령의 의미도 그대로입니다. 운영 배포·pin 승격 및 모바일 실기기 검증은 별도 인수입니다.
