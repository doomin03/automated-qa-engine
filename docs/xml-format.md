# Blueprint XML 공개 교환 규격

상태: 2026-10-29 **alpha.2 local-preview**. export 명령·엄격 parsing·속성 whitespace 보존은 사용자 Blueprint 왕복, 악성 XML 거부, 기존 파일 보존 테스트를 통과했다. 공개 bundle/XML fixture는 생성·의미 동등성·drift 검사를 통과했다. 원격 npm 게시를 뜻하지 않는다.

`contracts/release.json`은 alpha.2 공개 bundle metadata이며 `contracts/xml-release.json`은 XML fixture의 byte hash와 Blueprint snapshot hash를 기록한다. alpha.1 artifact는 보존한다. runtime/tgz 설치 검증은 별도 패키지 인수 기록을 따른다.

Engine 소유 `qa.blueprint/v1` JSON Schema의 XML 투영이다. 별도의 실행 언어가 아니며 웹 블록 편집기 또는 사용자가 작성한 XML을 같은 검증·plan·adapter 경로로 처리한다. 웹은 사용자용 공용 시나리오 배포와 진행 확인, Flutter Desktop은 개별 테스트 개발과 실제 실행을 담당한다.

## 구조

| 요소 | 속성 | 자식/내용 |
| --- | --- | --- |
| blueprint (root, 1개) | schemaVersion=`qa.blueprint/v1`, id, name 선택 | flow, selectors, target 각 1개; testCase 선택 |
| flow | id, entryNode, name 선택 | variables/metadata 선택; nodes, edges 필수 |
| nodes | 없음 | node 목록 |
| node | id, type; action/timeoutMs 선택 | params/condition/retry 선택 |
| edges | 없음 | edge 목록 |
| edge | from, to; label 선택 | 없음 |
| variables/metadata/params/condition/retry/selectors/target/testCase | 없음 | JSON 텍스트 또는 CDATA, XML 자식 금지 |

JSON 부분의 타입·허용 필드는 정본 schema로 검증한다. flow.schemaVersion은 `qa.flow/v1`로 복원한다. branch는 `condition={variable,operator,value}`, operator는 equals/notEquals이며 true/false label을 가진 outgoing edge가 각각 하나씩 필요하다. 나머지 start/action/assertion은 다음 edge 하나, end는 0개다. 유한 DAG만 허용한다.

속성의 `&`, `"`, `<`, `>`는 XML entity로 escape한다. 탭/줄바꿈은 `&#9;`, `&#10;`, `&#13;`로 보존한다. CDATA 내부 JSON 문자열의 `]]>`는 `]]]]><![CDATA[>`로 분할한다. JSON.stringify 후 CDATA로 감싸므로 boolean/null/숫자/문자열 타입을 유지한다. XML 주석은 실행 의미가 없다. DTD/entity 선언과 unknown element/attribute, 중복 singleton, JSON payload의 혼합 XML은 거부한다. 입력 제한은 UTF-8 1 MiB다.

## CLI

다음은 alpha.2 사용 순서다. 첫 export 명령은 기존 alpha.1 tgz에서는 제공하지 않는다.

```powershell
node packages/cli/aqa.mjs export my-test.qa.json --format xml --out my-test.xml
node packages/cli/aqa.mjs import my-test.xml --out imported.qa.json
node packages/cli/aqa.mjs validate my-test.xml
node packages/cli/aqa.mjs plan my-test.xml
node packages/cli/aqa.mjs run my-test.xml --json --report artifacts
```

export/import는 기존 출력 파일을 덮어쓰지 않는다. 가져오기·검증·계획 생성은 브라우저를 열지 않는다. run만 실제 실행한다. 이때 target의 서버/기기와 secretRef 주입 환경이 준비되어 있어야 한다.

특정 데모 node/selector/URL에 종속하지 않는다. Engine schema/capability가 지원하는 사용자 action/selector/target 조합을 받아 검증한다. 블록→XML 또는 직접 XML→정규화 JSON→검증된 plan→adapter→events/result가 동일 경로다. 현재 실제 adapter는 Playwright(web)이며 Appium(Android/iOS)은 후속 구현이다. XML은 Appium에 직접 전달하지 않는다.

## 공개 artifact

`contracts/release.json`과 `contracts/xml-release.json`의 engineVersion 및 SHA-256으로 공개 bundle/fixture를 검증한다. JSON/XML canonical hash는 객체 키를 재귀 정렬한 JSON 기준이며 배열 순서는 보존한다. XML byte hash와 Blueprint snapshot hash는 목적이 다르다.

웹 serializer는 이 공개 규격을 구현하고 Engine CLI 왕복 contract test로 확인한다. Engine 내부 source를 웹에 복사하거나 import하지 않는다. Desktop은 자체 실행 schema나 XML parser를 만들지 않고 고정 Engine CLI를 호출한다.
