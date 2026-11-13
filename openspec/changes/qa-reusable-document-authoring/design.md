# Design

## Context

현재 main `8dd206a24657324c5675f4bb092d69c6ba366e7f`의 공개 runtime은 alpha.8이다. `template`는 로그인 데모 파일을 반환하고, `preset`은 두 UX 검사, `expand`는 유한 반복 작성 문서를 처리한다. Checker `xml_block_compiler.dart`는 파일 블록을 단일 Blueprint로 합성한다. 이 변경은 그 순수 의미 변환과 재사용 기술 템플릿을 Engine 공개 경계로 이동한다. 실행 interpreter나 PTY를 새로 만들지 않는다.

근거는 관리 보고서 `C:/workspace/QA/docs/engine-checker-responsibility-redistribution-20261112.md`, `multi-terminal-workbench-planning-20261112.md`, 읽기 전용 Checker compiler/model과 기존 Engine compiler/documents/authoring 입력 경계다. 보고서의 기획 완료 기록은 제품 완료 증거가 아니다.

counterpart는 Checker `qa-multi-terminal-workbench`. dependsOn은 Engine `qa-engine-modular-refactor`, `qa-bounded-authoring`, `qa-captured-variables` 및 Checker `qa-desktop-xml-block-studio`의 기존 조합 제약/동등성 fixture다. Checker 제품 코드를 Engine에서 import하거나 필수 설치하지 않는다.

## Goals / Non-Goals

목표는 모델·UI와 독립적인 template/compose API와 CLI, 결정적 Blueprint/XML/sourceMap, 출처 검증과 구조화 진단, 독립 패키지 소비다. 기존 유효 조합의 ID·변수·분기·snapshot 의미를 유지한다.

다중 PTY, provider flags/설정/skill 설치, cwd 신뢰, 라이브러리 프로젝트 저장, undo/좌표, 권한·게시·예약, 자동 실행은 Checker 책임이다. 다중 target, 병렬 outer graph, 임의 코드, 무한 반복, 범용 workflow DSL은 추가하지 않는다. 실기기 검증과 운영 서버 pin 승격도 이번 인수에 포함하지 않는다.

## Decisions

### D1. 실행 계약과 작성 계약의 분리

runtime은 `0.1.0-alpha.9`, 실행 contract는 `0.3.0-draft.2`를 유지한다. `qa.schema.json`과 Agent HTTP 계약 바이트는 변경하지 않는다. 별도 `contracts/schemas/qa-authoring.schema.json`에 작성 입력/응답/catalog/diagnostic/sourceMap 정의를 제공한다. `contracts/authoring-release.json` 및 `contracts/releases/qa-authoring-0.1.0-draft.1.json`이 authoring contractVersion, runtimeVersion, 실행 schema SHA, 작성 schema SHA, template 정의를 고정한다. hash는 자기 hash 필드를 포함하는 순환 정의 대신 발행된 bundle 파일의 정확한 바이트 SHA-256으로 외부 manifest에 기록한다.

공개 root exports/types에 `listTemplates()`, `createTemplate(request)`, `composeBlueprint(input)`을 추가한다. 기존 exports, bin/CLI 경로, `template`/`preset`/`expand`/실행 의미는 유지한다. 작성 모듈은 compiler/codec/domain을 사용하며 adapter/runner/Agent를 호출하지 않는다. CLI 출력 writer 프로세스는 기존 transport이며 QA 실행이 아니다.

### D2. 기술 템플릿의 정확한 지원 범위

각 template는 id, version `1.0.0`, canonical 정의의 raw hex SHA-256, binding JSON Schema, supportedPlatforms, requiredActions, 설명을 가진다. `listTemplates()`는 authoringContractVersion과 이 catalog를 반환한다. `createTemplate({templateId, version, sha256, bindings})`는 세 pin 모두 검사한다. 유효 bindings가 없으면 오류와 필드 진단만 반환하며 placeholder URL/app/selector나 fixture 비밀값을 채우지 않는다.

| ID | 지원 플랫폼 | 필수 bindings | 생성 의미 |
| --- | --- | --- | --- |
| `empty` | web/android/ios | `id`, `target` | 기존 schema의 start→end, 빈 selectors. 실행 가능한 문서 구조일 뿐 실제 QA 검사가 수행되었다는 뜻이 아니다. 최소 동작 노드가 없으므로 compose 자산으로는 거부한다. |
| `web-open-click` | web | `id`, `target`, `selectors`, `launch`, `selector` | launch→waitFor(selector)→tap(selector) |
| `web-input-check` | web | `id`, `target`, `selectors`, `launch`, `selector`, `value` | launch→waitFor→input→assertValue. 값은 문자열 또는 `{secretRef}`이며 후자는 from:secret 변수와 valueRef/expectedRef로만 생성한다. |
| `native-open-check` | android/ios | `id`, `target`, `selectors`, `launch`, `selector` | launch→assertVisible. 플랫폼 locator가 필요하다. Appium 주소·udid·credential은 bindings에 받지 않는다. |

target/selectors는 기존 실행 문서 형식이며 launch는 target.launchTargets의 실제 alias다. template 지원은 기능 구현 정보이며 연결 기기나 앱 접근 가능성 증거가 아니다. binding의 모르는 필드/플랫폼 불일치/미등록 alias를 거부한다. 새 template는 기존 preset.metadata를 붙이지 않아 아래 compose 제한과 충돌하지 않는다. UX 가림/focus 검사는 기존 preset의 별도 의미로 남는다.

### D3. 파일 경로 없는 순수 합성 입력

`composeBlueprint` 입력은 다음 구조다. 필드별 정본은 별도 작성 schema로 배포한다.

```json
{
  "schemaVersion": "qa.composition/v1",
  "assets": [{"id": "login", "format": "xml", "source": "<qa-blueprint>...</qa-blueprint>", "sha256": "<raw UTF-8 SHA-256>"}],
  "instances": [{"id": "block-1", "assetId": "login"}],
  "links": []
}
```

위 source는 구조 설명용 문자열이고 유효 XML 예제가 아니다. 실제 fixture와 공개 예제는 기존 XML 정본으로 작성·검증한다. asset format은 xml/json이고 source는 문자열이다. raw UTF-8 hash를 먼저 대조한 뒤 기존 parse/compile 경계에서 원문을 검증한다. 호출자가 제공한 pre-parsed Blueprint나 validation 성공 플래그를 신뢰하지 않는다. assets/instances ID 중복, 없는 asset/link 참조를 거부한다.

sourceFile/include/URL/좌표/undo/provider/session 필드는 받지 않는다. 따라서 자산 path traversal, UNC 또는 symlink를 따라가는 source resolution 자체가 없다. Checker는 assetId→사용자 경로 매핑을 UI에서 별도 유지한다. bindings는 template 생성 시 확정하며 compose에 숨은 per-instance 값 치환은 없다. 원본의 literal/secretRef/captured variable 의미를 그대로 이름 공간에 옮긴다.

직접 API 입력에도 기존 authoring safeJsonBytes 수준의 방어를 적용한다. accessor/toJSON 호출, custom prototype, symbol/hidden/reserved key, sparse array, cycle, 깊이 128 이상을 거부한다. 입력 envelope는 UTF-8 compact JSON 1 MiB 이하, assets/instances 각각 최대 64, 최종 nodes 1000/edges 2000 이하, 생성 Blueprint JSON과 XML 각각 1 MiB 이하, 전체 응답은 4 MiB 이하로 제한한다. 초과 시 부분 Blueprint를 성공 응답으로 반환하지 않는다.

### D4. 기존 조합 의미와 deterministic namespace

outer graph는 모든 instance를 정확히 한 번 포함하는 하나의 순차 chain이다. 단절/cycle/self-link/다중 incoming 또는 outgoing/중복 link를 거부한다. 각 자산의 내부 DAG와 branch label은 유지한다. 원본 자산은 정확히 하나의 start/end와 최소 한 개의 동작 또는 branch 노드를 가져야 한다. start의 outgoing은 하나이고 end 직결은 불가하다. 지원 node type은 start/end/action/assertion/branch다.

모든 target 전체 canonical 값이 같아야 한다. references/testCase, Blueprint 또는 flow의 preset metadata, target.profile, node.params.reference는 기존 Checker와 같이 거부한다. 이 제한을 제거하려면 별도 의미/자원 합성 설계가 필요하다.

새 ID는 기존 Dart와 동일하게 `b_` + `SHA256_UTF8(instanceId + '/' + kind + '/' + originalId).hex.slice(0,24)`다. kind는 node/variable/selector다. 생성 ID 충돌은 검사 후 거부한다. node.id, params.selector/valueRef/expectedRef, capture params.variable, branch.condition.variable을 참조 map으로 치환한다. 외부 secret ref 문자열은 바꾸거나 resolve하지 않는다.

원본 start/end를 제거하고 `composition_start`/`composition_end`를 넣는다. end로 향한 branch edge의 label을 다음 instance 진입 edge까지 보존한다. 내부 node/edge 배열 순서를 보존하며 assets/instances/links 목록 순서나 JSON object key 순서가 chain 결과에 영향을 주지 않는다. 동일 topology/원문으로 결정적 출력을 만든다. 원문 bytes가 바뀌면 sourceHash는 달라질 수 있다.

기존 Blueprint/flow/selectors id(`xml-composition`, `xml-composition-flow`, `xml-composition-selectors`)와 name(`XML 블록 조합`)을 유지한다. provenance는 Blueprint에 임의 삽입하지 않고 응답 sidecar에 둬 기존 snapshot hash를 보존한다. 실제 Dart 실행 golden fixture로 반복 instance, branch 종료 label, literal/secret/capture 참조와 output canonical hash를 대조한다.

### D5. 결과, sourceMap, 진단

두 생성 API의 성공 결과는 `schemaVersion: qa.authoredBlueprint/v1`, `authoringContractVersion`, `blueprint`, `xml`, `blueprintSnapshotHash`, `flowSnapshotHash`, `template`, `sourceMap`, `diagnostics: []`다. template 생성은 `{id,version,sha256}`와 sourceMap:null, compose는 template:null과 다음 sourceMap을 반환한다. snapshot hash는 기존 compiler의 `sha256:` prefixed canonical hash이며 raw source/template/bundle SHA와 구분한다. 반환 객체를 caller 변경으로 오염되지 않는 불변 snapshot으로 만든다.

sourceMap은 `schemaVersion: qa.compositionSourceMap/v1`, 동일 두 snapshot hash, `nodes` map, `syntheticNodes: ['composition_start','composition_end']`다. 각 비합성 node는 `{instanceId,assetId,sourceNodeId,sourceHash}`로 원본과 연결한다. 원본 start/end를 가짜 실행 노드로 대응시키지 않는다. sourceFile은 Checker가 추가할 UI 데이터이며 Engine 계약 필드가 아니다.

XML export 후 기존 parser/compiler로 왕복하여 snapshot hash를 확인한다. 성공은 검증된 작성 문서이지 run outcome이 아니다. 생성 API는 네트워크/브라우저/기기/secret resolver를 사용하지 않는다.

실패는 기존 QaError transport/code/exit 의미를 유지하고 details.diagnostics에 `{code,path,message,assetId?,instanceId?,sourceNodeId?}`를 추가한다. 필드 path는 JSON Pointer, message는 원문·값·절대 경로를 복사하지 않는 설명이다. 구조/입력 오류는 INVALID_DOCUMENT, 이미 존재하는 compiler 오류/UNSUPPORTED_CAPABILITY는 본래 code를 유지한다. 상한 64개, 검사 순서는 envelope→ID/hash→asset ID 정렬 원문 검증→outer chain→target/지원 범위→치환→최종 compile/roundtrip이다. 첫 오류에 유한 진단을 붙이며 전체 오류 수집을 약속하지 않는다. 실패 응답에 부분 실행 문서가 없다.

### D6. CLI와 파일 입출력

추가 명령은 `aqa templates list`, `aqa templates show ID --template-version V`, `aqa templates create ID --template-version V --template-sha256 HEX --bindings FILE`, `aqa compose FILE`이다. list/show는 JSON metadata, create/compose는 기본적으로 D5 JSON envelope 한 개를 stdout에 출력한다. `--json`은 명시할 수 있고 같은 machine 결과를 유지한다. create/compose의 `--out FILE`은 동일 envelope 파일 하나를 exclusive create로 쓰며 성공 stdout은 비어 있다. XML을 직접 실행하려면 응답 xml을 별도 저장 후 기존 validate/plan/run을 명시 호출한다. 명령에 자동 run/exec/overwrite/force 옵션은 없다.

입력은 bounded regular-file read(max+1), JSON syntax/schema 검증을 거친다. 기존 `--document-root DIR` containment 옵션을 지원하며 입력과 output parent의 실제 경로가 root 내부여야 한다. root 밖 symlink/junction 경로와 `..`/absolute/UNC를 통한 탈출은 거부한다. root 미지정 시 사용자가 명시한 로컬 파일 경로를 허용하는 기존 CLI 호환 정책이며 OS sandbox가 아니다. output은 기존 파일/링크를 overwrite하지 않으며 부모 디렉터리를 자동 생성하지 않는다. 같은 원본 파일을 out으로 지정하면 거부한다. 실패 중 부분 output은 해당 호출이 새로 만든 파일만 정리하고 원본은 보존한다. 경로 검사 이후 외부 프로세스가 디렉터리를 바꾸는 OS race까지 격리한다고 주장하지 않는다.

error stdout JSON/선택 `--diagnostics stderr`, exit code, 출력 backpressure deadline은 기존 CLI transport를 사용한다. 새 명령의 잘못된 위치 인자·무관 flag도 strict 거부한다. 독립 작성 요청은 전역 실행/cancel 상태를 공유하지 않는다. Checker 서비스의 dispose/cancel/동시 작업 배정 정책은 Checker 인수다.

### D7. 구현 경계와 배포 게이트

core 작성 경계에 catalog/template binding/composition/source mapping을 분리하고 기존 compiler·XML codec·canonical/immutable/input primitive를 재사용한다. 기존 repeat authoring parser의 정책을 약화하거나 새로운 execution DSL을 넣지 않는다. CLI는 별도 document-authoring handler에서 facade를 호출한다. architecture gate, 공개 d.ts, generation/drift 검사, npm files를 함께 갱신한다.

검증은 결정적 pure API→기존 Dart golden 차등→CLI 오류/파일 경계→실제 명시 실행→별도 npm 설치 consumer 순서다. 외부 consumer는 package 이름 import와 npm bin, 타입, catalog pin/hash, compose/XML roundtrip, 실제 웹 PASS/의도 FAIL 및 sourceMap 대응을 검사한다. 생성 단계에는 adapter/브라우저/네트워크 호출이 없음을 별도 spy/격리 검사한다. 모바일은 생성·schema/protocol 수준이며 실기기 성공으로 보고하지 않는다.

alpha.6/alpha.8 tgz와 실행/Agent schema 불변을 SHA로 대조한다. alpha.9 설치 manifest 전체와 bundle/authoring hash를 관리자가 확인한 다음 Checker가 별도 설치하여 소비한다. 기존 프로젝트/Release/server pin은 자동 변경하지 않는다.

## Risks / Trade-offs

- 기존 Dart 유효 조합과 동등하지만 입력에 조용히 덮어쓰던 중복 asset ID는 새 계약에서 거부한다. invalid input 호환으로 간주하지 않는다.
- caller가 sourceHash를 다시 계산할 수 있으므로 hash 일치는 신뢰/서명/권한 증명이 아니다. 생성은 사용자 정책 실행 승인을 대체하지 않는다.
- literal로 비밀값을 넣으면 작성 문서 자체에 남는다. Engine이 비밀을 추론해 제거한다고 보장하지 않으며 secretRef variant를 명시한다. 진단에는 원문을 복사하지 않는다.
- sourceMap은 실행 snapshot 기준이다. 편집 후 이전 sourceMap 재사용은 Checker가 두 snapshot hash를 확인해 차단해야 한다.
- 순차 outer 제한, 단일 target, reference/profile/preset 거부를 UI에 명시해야 한다. 지원하지 않는 조합을 placeholder나 성공 상태로 바꾸지 않는다.

## Migration Plan

관리자가 D1–D7과 네 template/bindings/단일 envelope를 검토·승인했다. strict PASS 후 apply하며 실행 schema 불변/기존 fixture 기준을 먼저 고정한 뒤 작성 schema/API/CLI/tests를 구현한다. 검증된 alpha.9 archive/hash를 인계하고 Checker가 library/undo/sourceFile adapter를 연결한다. 구 Engine 사용 시 명시 미지원이며 기존 파일을 조용히 재저장하거나 Dart fallback으로 성공을 가장하지 않는다. 기획 문서의 완료 상태와 제품 인수 상태는 별도 유지한다.

## Open Questions

구현 범위를 바꾸는 미결정 질문은 없다. D2의 네 template ID/bindings와 D5/D6의 단일 JSON envelope는 관리 승인되었다. 구현/새 runtime 발행은 아직 완료된 것이 아니다. 기존 실행 및 Agent 계약의 바이트 변경은 이 변경에서 허용하지 않는다.
