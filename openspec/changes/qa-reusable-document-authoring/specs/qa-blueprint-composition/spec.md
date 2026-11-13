# Spec Delta

## Purpose

Checker에 존재하던 파일 블록 의미 합성을 독립 Engine의 순수 작성 API와 CLI로 제공한다. 원문 출처와 UI instance를 결정적 실행 snapshot/sourceMap에 연결하되 경로, UI 편집 상태, 터미널 및 실행 승인은 소비자 책임으로 유지한다.

## ADDED Requirements

### Requirement: Bounded source and identity validation
Engine은 assets(id,format,source,sha256), instances(id,assetId), links(from,to)의 qa.composition/v1을 SHALL 받는다. raw UTF-8 hash와 XML/JSON parse/compile을 기존 실행 검증으로 MUST 확인한다. 중복/미지 ID, 안전하지 않은 직접 API 객체, 크기/깊이 초과, 미지 필드는 부분 결과 없이 MUST 실패한다.

#### Scenario: Invalid source or spoofed prevalidation
- **WHEN** 원문 hash가 다르거나 source가 유효하지 않거나 pre-parsed Blueprint/validated 플래그를 추가한다
- **THEN** 유한 필드/asset 진단으로 거부하고 caller의 성공 주장을 신뢰하지 않는다

#### Scenario: Input exceeds a declared budget
- **WHEN** 1 MiB 입력, 64 assets/instances, 1000 output nodes/2000 edges 또는 design D3 응답 한도를 초과한다
- **THEN** 한도 오류를 반환하고 불완전 문서 생성/실행을 시작하지 않는다

#### Scenario: Direct API object contains side-effect accessors
- **WHEN** getter/toJSON/custom prototype/symbol/hidden/reserved key/cycle/sparse array를 입력한다
- **THEN** accessor를 실행하지 않고 기존 authoring 입력 보안 경계로 거부한다

### Requirement: Sequential single-target composition
Engine은 각 내부 DAG를 보존하며 연결된 단일 비순환 outer chain을 SHALL 합성한다. canonical target 동등성, 자산마다 start/end 각 하나와 내부 노드 하나 이상을 MUST 요구한다. outer cycle/분기/단절/중복 link, 미지원 node와 reference/profile/testCase/preset 합성은 design D4대로 MUST 거부한다.

#### Scenario: Repeat one asset as distinct instances
- **WHEN** 동일 원문 asset을 서로 다른 두 instance로 연결한다
- **THEN** 서로 다른 namespace로 각 내부 DAG를 한 번씩 보존하며 하나의 target만 사용한다

#### Scenario: Unsupported resource or target merge
- **WHEN** target이 다르거나 reference/profile/preset를 가진 자산을 조합한다
- **THEN** 명시 오류를 반환하고 자원/정책을 묵시 병합하거나 버리지 않는다

### Requirement: Legacy namespace and semantic equivalence
Engine은 기존 Dart의 b_+SHA256(instanceId/kind/originalId) 앞 24 hex namespace, 참조 치환, 내부 배열 순서와 branch 종료 label을 MUST 보존한다. 기존 composition ID/name을 SHALL 유지하고 생성 ID 충돌을 거부한다. 동등 입력의 나열 순서는 같은 canonical Blueprint/snapshot hash를 MUST 생성한다.

#### Scenario: Captured variables and branch exit survive composition
- **WHEN** capture 선언/참조, branch condition, expectedRef 및 end로 향한 true/false label이 있는 유효 자산을 연결한다
- **THEN** 모든 참조를 같은 instance namespace로 바꾸고 다음 진입점까지 label 의미를 보존한다

#### Scenario: Compare with actual Dart compiler output
- **WHEN** 기존 Dart를 직접 실행한 반복/분기/capture/secret reference golden fixture를 Engine compose에 제공한다
- **THEN** canonical Blueprint 및 snapshot hash가 일치하고 sourceFile을 제외한 sourceMap 원본 대응 값이 일치한다

#### Scenario: Permute input catalog and object keys
- **WHEN** 같은 topology/원문으로 assets/instances/links의 나열 순서와 객체 key 순서를 바꾼다
- **THEN** 생성 Blueprint/XML 및 대응 sourceMap이 결정적으로 동일하다

### Requirement: Authored result and source mapping
Engine은 Blueprint/XML/두 compiler snapshot hash/nullable template·sourceMap/빈 diagnostics를 가진 qa.authoredBlueprint/v1을 SHALL 반환한다. composition sourceMap은 원본 asset/instance/node/source hash와 합성 start/end를 MUST 구분한다. XML 왕복은 snapshot을 MUST 보존하고 반환 객체는 독립 불변 snapshot이어야 한다.

#### Scenario: Map an actual event node back to the editor
- **WHEN** 명시 실행에서 generated nodeId event가 나온다
- **THEN** 같은 Blueprint/flow snapshot의 sourceMap으로 instance/source node를 찾고 다른 snapshot의 map을 유효하다고 제시하지 않는다

#### Scenario: Keep local UI path out of execution semantics
- **WHEN** 같은 원문이 다른 파일경로 또는 화면좌표에 놓인다
- **THEN** Engine 응답 의미는 바뀌지 않으며 Checker가 assetId로 sourceFile/좌표를 별도로 보강한다

### Requirement: Structured bounded failure diagnostics
Engine은 기존 QaError code/transport를 유지하며 안정적인 code/JSON Pointer path/선택 출처 ID의 진단 최대 64개를 SHALL 추가한다. 검증 순서는 design D5를 SHALL 따른다. 메시지에 원문/비밀값/로컬 절대경로 복사를 MUST 방지하고 실패 시 부분 실행 Blueprint를 MUST NOT 반환한다.

#### Scenario: Source fails a semantic compiler check
- **WHEN** 원본이 secret branch 또는 없는 selector를 참조한다
- **THEN** 기존 정책/semantic error 의미와 asset/필드 대응을 보존하고 입력 원문을 진단에 덤프하지 않는다

### Requirement: Safe additive CLI document authoring
Engine은 compose FILE/templates create에 단일 JSON envelope와 선택 exclusive --out을 SHALL 제공한다. bounded regular-file read와 선택 --document-root realpath containment는 symlink/junction을 포함한 입력/output parent 탈출을 MUST 거부한다. 기존/원본 파일을 MUST NOT 덮어쓰며 미지 flag/인자는 MUST 실패한다.

#### Scenario: Reject an attempted overwrite or root escape
- **WHEN** out이 원본/기존 파일이거나 document-root 밖으로 향하는 경로 또는 symlink parent다
- **THEN** 오류를 반환하고 원본/기존 파일을 보존한다

#### Scenario: Do not resolve asset paths
- **WHEN** sourceFile/include/URL 등의 자산 경로 지시 필드를 입력한다
- **THEN** unknown-field 오류로 거부하고 외부 파일이나 네트워크를 읽지 않는다

### Requirement: Pure authoring and explicit runtime acceptance
API/CLI 작성은 QA action을 실행하거나 run 취소 상태를 MUST NOT 공유한다. 인수는 독립 package API/bin/types, 정확한 release hash, Dart 동등성, 명시 실제 웹 PASS/FAIL/cancel 및 sourceMap event identity를 SHALL 검증한다. 실행 schema/Agent 바이트와 frozen archive는 MUST 보존한다.

#### Scenario: Concurrent independent authoring calls
- **WHEN** 서로 다른 두 composition 입력을 동시에 검증한다
- **THEN** 결과/진단/state가 섞이지 않고 browser/Appium/secret resolver가 시작되지 않는다

#### Scenario: Explicit consumer cancels a generated run
- **WHEN** 별도 설치 consumer가 합성 문서를 명시 run 후 기존 stdin control로 취소한다
- **THEN** 기존 cancelled terminal/result/cleanup 계약을 검증하고 작성 성공을 실행 성공으로 합성하지 않는다
