# Design

## Context

기존 Flow는 유한 DAG와 unique node ID를 요구한다. qa.blueprint/v1 JSON/YAML/XML은 compileBlueprint로 검증되고 실행 event는 확장된 노드 ID를 사용한다. 현재 alpha.4 정본은 256 nodes/512 edges이며 alpha.5 통합에서 parent가 1000/2000으로 올린다. 제안의 목적은 proposal을 따른다.

## Goals / Non-Goals

**Goals:** 작성 문서의 반복을 미리 펼쳐 실행기를 변경하지 않고 반복/분기 조합을 표현한다. 원본 대응표는 별도 sidecar여서 실행 snapshot 의미를 바꾸지 않는다.

**Non-Goals:** runtime loop, nested repeat, repeat body branch, 반복 index 변수, JS/eval, 외부 파일 참조 해석, Checker 구현은 제외한다. 부모 담당의 capture variable 변경과 별개다.

## Decisions

- 입력은 `{schemaVersion:'qa.authoring/v1',blueprint:<Blueprint>}`다. Blueprint의 flow.nodes에 `{id,type:'repeat',count,steps}`를 허용한다. repeat는 정확한 네 필드만 허용하며 count 정수 1..100, steps 비어있지 않은 순차 action/assertion 배열이다. steps의 id는 해당 repeat 안에서 유일하고 일반 node와 같은 문자/128자 규칙이다. nested repeat/branch/start/end body는 UNSUPPORTED_CAPABILITY다. repeat 자체 timeout/retry/조건은 없다. 각 step의 기존 timeout/retry가 그대로 복제된다.
- `expandAuthoring(document)`은 `{blueprint,sourceMap}`을 반환한다. `parseAuthoringSource(text,format='json')`은 JSON/YAML/yml/XML을 파싱해 유효한 authoring 객체를 반환한다. `authoringXml(document)`은 XML을 작성한다. 모두 모듈 내부 입력 한도·형태 확인 후 compileBlueprint를 사용한다. 외부 원본을 수정하지 않는다. core parseSource/CLI/정본 schema/public types는 parent가 통합한다.
- generated ID는 `repeat_` + SHA-256(JSON.stringify([repeat.id, iteration, step.id]))의 전체 64자리 hex다. iteration은 1부터 시작한다. 위치순번이나 임의 random값을 사용하지 않아 repeat/step 배열 밖 수정으로 ID가 바뀌지 않는다. 반복 생성 ID가 기존 top-level ID 또는 다른 생성 ID와 충돌하면 INVALID_FLOW다.
- sourceMap은 `{schemaVersion:'qa.authoringSourceMap/v1',authoringHash,blueprintSnapshotHash,nodes}`다. nodes는 expanded flow.nodes 순서의 `{nodeId,sourceNodeId,sourceStepId?,iteration?}` 배열이다. 일반 노드는 sourceNodeId=nodeId만, repeat 노드는 원본 repeat ID/step ID/iteration을 기록한다. hash는 기존 canonical JSON SHA-256 규칙이다. sourceMap은 Blueprint에 넣지 않고 읽기용 진도 대응에만 사용한다. sourceMap과 Blueprint는 반환 시 immutable이다.
- source edge는 원본 top-level ID만 참조해야 한다. 각 repeat incoming edge를 첫 생성 node로, outgoing edge를 마지막 생성 node에서 나오도록 바꾼다. body와 iteration 간에는 순차 edge를 추가한다. 바깥 branch의 label은 보존한다. 원래 repeat가 1개의 unlabeled outgoing을 가져야 한다. source cycle/dangling/unreachable/entry/start/branch 규칙은 rewiring 후 기존 compiler도 검사한다.
- count와 전체 expanded node 수(1000), edge 수(2000)는 복제 전에 확인한다. JSON 구조 크기를 미리 합산해 확장 Blueprint 1MiB를 넘으면 큰 복제 allocation 전에 거부한다. 입력 text 및 직접 객체의 JSON 표현도 1MiB 이하, 깊이는 128 미만이며 cycle/비JSON 값/예약 키(__proto__,constructor,prototype)를 거부한다. YAML duplicate keys 및 유한 alias 제한을 적용한다.
- XML은 `<authoring schemaVersion="qa.authoring/v1"><blueprint><![CDATA[JSON blueprint]]></blueprint></authoring>`다. 기존 Blueprint XML과 다른 루트여서 혼동하지 않는다. CDATA terminator는 표준 split CDATA로 보존한다. 하나의 root/blueprint, 필수 schemaVersion 외 unknown/중복 attribute/element, DTD/entity, 과도한 XML depth를 거부한다. payload는 CDATA text만이며 일반 XML child 실행 문법을 만들지 않는다.
- loop interpreter 대신 유한 전개를 택한다. existing event identity/run snapshot/cancel/failure 흐름을 그대로 검증할 수 있다. body branch/nesting은 제한을 명시해 폭발적인 전개나 불명확한 source mapping을 피한다.

## Risks / Trade-offs

- 반복마다 ID가 길어짐 → 원본 repeat/step/iteration의 sourceMap으로 표시한다.
- 입력은 작아도 확장 결과가 큼 → 1000 nodes/2000 edges/1MiB를 allocation 전에 제한한다.
- alpha.4 schema256 한도와 alpha.5 목표1000 차이 → 256 이하를 우선 실제 검증하고 parent schema 상향 이후 1000 boundary 인수 task를 별도로 완료한다.
- 작성 파일만 바꾸고 오래된 sidecar를 사용할 수 있음 → authoringHash와 blueprintSnapshotHash를 함께 비교한다.

## Migration Plan

alpha.4 산출물은 보존하고 이 모듈을 alpha.4 release의 공개 기능으로 광고하지 않는다. parent가 alpha.5 정본/exports/CLI/types 및 package 테스트를 마친 뒤 사용한다. 생성된 표준 Blueprint는 기존 실행 API에 직접 전달할 수 있으며 repeat 원본은 별도로 보관한다.
