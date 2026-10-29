# AI CLI로 Blueprint 작성하기

GUI에 넣을 정책은 **가져오기·검토·진행 확인**이다. 실행 규격과 액션 허용 정책은 engine에 둔다. 특정 모델 SDK나 프롬프트가 GUI의 유일한 실행 경로가 되지 않는다.

## 공급자 중립 흐름

1. aqa schema와 aqa template 출력을 Claude/Codex 등 사용하는 CLI에 제공한다.
2. AI가 qa.blueprint/v1 JSON/YAML 또는 지정 XML을 파일로 작성한다.
3. aqa validate FILE로 구조/graph/selector/target을 검사한다. 오류 JSON을 같은 CLI에 전달해 수정할 수 있다.
4. aqa plan FILE로 실행 노드·필요 action·secretRef를 확인한다.
5. 사용자가 aqa run FILE을 명시적으로 실행한다. import/validate/plan은 브라우저를 열지 않는다.
6. Checker에 실행 폴더의 blueprint.json과 events.jsonl을 불러오거나 파일 따라가기로 진행을 본다.

이 버전은 모델 CLI를 자동 설치·인증·호출하지 않는다. AI 사용료와 자격증명은 선택한 CLI가 관리한다.

## CLI에 전달할 작업 지시 예

```text
첨부된 JSON Schema와 template를 따라 qa.blueprint/v1 문서를 만들어라.
허용된 테스트 환경과 실제 testId/selector 정보만 사용하라.
불명확한 selector나 expected를 지어내지 말고 필요한 정보를 표시하라.
비밀번호는 {from: secret, ref: login.password}로 참조하고 실제 값을 문서에 쓰지 마라.
start/action/assertion/branch/end와 유한 DAG만 사용하라.
결과 파일에 aqa validate를 실행하고 오류를 수정하라. run은 요청하지 않았다면 실행하지 마라.
```

## XML

CLI의 template --format xml이 정확한 예제를 출력한다. blueprint root의 id/schemaVersion, flow의 id/entryNode, nodes/node와 edges/edge를 사용한다. 복합 params/variables/selectors/target/testCase는 CDATA 안의 JSON으로 표현해 XML별 또 다른 타입 체계를 만들지 않는다.

```xml
<node id="submit" type="action" action="tap">
  <params><![CDATA[{"selector":"submit"}]]></params>
</node>
```

DTD/entity 선언, 알 수 없는 태그/속성, 임의 shell/eval을 거부한다. JSON/YAML/XML은 같은 canonical JSON 계획과 해시로 변환된다. 1 MiB 입력 제한과 YAML alias/depth 제한이 있다.

## Blueprint 진행 규칙

run.started에 blueprintSnapshotHash를 넣는다. event identity는 runId/attempt/sequence다. Checker는 다른 문서의 hash, sequence gap, 상충 중복, 잘못된 node 종료를 거부한다.
노드 상태는 대기/실행 중/성공/실패/환경 오류/취소/미실행이다. 실행하지 않은 분기와 실패 후 남은 노드를 성공으로 칠하지 않는다. AI 작성 성공과 테스트 통과도 별개다.

