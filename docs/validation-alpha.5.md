# Engine alpha.5 인수 기록

2026-10-31, C:/workspace/QA/automated-qa-engine, main/HEAD ecdb8ff87b1b45b93a38921a44d36c8adb068cd8 이후 미커밋 작업. commit/push/npm publish 없음. alpha.2/3/4 고정 배포물 보존.

## 고정 산출물

- runtime: 0.1.0-alpha.5 / contract: 0.3.0-draft.1, 실행 Blueprint/event/result schema v1.
- tgz: artifacts/package/0.1.0-alpha.5/automated-qa-engine-0.1.0-alpha.5.tgz
- SHA-256: 1fdd43ca48df3b9377202eb1640d3c61e1fc0c65acc4a8847d4d28e95a2a9bb7
- integrity: sha512-CmmyAa2NYcHd0bISXXMXdiUUzOm968h/dQPA/FvabUMPL9OINI9+tVYRNor9nyQ93qSFcFFLnDfGRSZiVVJIAA==
- bundle: contracts/releases/qa-contract-0.1.0-alpha.5.json
- bundle SHA-256: b183b90e0a8d93ab531b10ca409a4e657003fd85812a131f97479695283a5370
- XML: contracts/releases/qa-blueprint-0.1.0-alpha.5.xml
- XML SHA-256: bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729
- XML snapshot: sha256:1e24d3c9a5217aa706a02a4ef7620192673f508bb19fbd2e661a13e9756589a1

같은 package 디렉터리의 verification.json/pack-manifest.json에 설치 경로·모든 run 및 package 포함 파일 증거가 있다. 이 인수 후 package 포함 파일은 수정하지 않았다. authoring/module/docs/type/CLI는 tgz에 포함한다. XML 예제 bytes는 alpha.4와 같지만 새 bundle은 추가 계약을 포함하므로 runtime/bundle pin은 달라진다.

## 검증 명령과 결과

`npm run verify`: **128 tests PASS, failed 0, skipped 0**, OpenSpec strict **11/11**, foundation 및 bundle/type drift PASS. 실행 시간 약151초. 후속 내부 리뷰/인수 문서만 갱신한 뒤 foundation/strict/diff를 다시 확인한다.

`npm run test:package`: 별도 임시 프로젝트 `C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-Ghiw7T`에 npm pack tgz를 설치하여 package-name API/설치 CLI, TS6.0.3 valid 소비 통과·invalid 소비 거부 및 **26회 실행** 인수 PASS.

| 묶음 | 인수 |
| --- | --- |
| 기존 7 runs | API PASS/FAIL/cancel, CLI XML PASS/FAIL, 실패 후 observer rejection, Windows child stdin cancel exit5 |
| 디자인/UX 10 runs | 이미지 PASS/FAIL/profile blocked, 측정 PASS/FAIL, overlay/focus 실패, XML CLI, API cancel 및 report/hash |
| Appium protocol 3 runs | API PASS/FAIL와 설치 CLI native PASS. 실제 Android/iOS 기기 인수가 아님 |
| authoring/capture 4 runs | API/CLI 각각 반복 XML 확장→capture 재사용 실제 Chromium PASS/의도적 FAIL, 원본 bytes/sourceMap/hash/고유 node identity |
| secret screenshot 2 runs | 실제 Chromium에서 optional step.skipped/run.passed, required step/run.blocked, PNG 없음 |

모든 실행의 schema, sequence/runId/terminal, artifact bytes SHA/size를 검증했다. 캡처 값은 blueprint/plan/result/events에 없고 secret resolver를 호출하지 않는 회귀를 별도로 확인했다. authoring sourceMap은 13개 노드를 가리키며 반복 생성 노드9개가 고유하다. 1000개 확장 성공/1001개 거부는 compiler 경계 테스트이며 1000개의 실제 브라우저 조작 인수를 의미하지 않는다.

## 신규 정책과 수정

- `expand FILE --out FILE`은 원본 XML/JSON/YAML과 sourceMap을 보관하고 실행 Blueprint를 생성한다. run은 확장 Blueprint를 명시적으로 받는다.
- public capture는 모든 도달 경로 definite assignment, 재캡처 전 이전 값 삭제, password/OTP/data-qa-sensitive/secret flow 거부, DOM·문자열 한도를 적용한다.
- `--document-root`는 TC/Suite/selector/target realpath containment를 선택 적용한다. 기본 상대 경로 호환을 유지한다.
- secrets-file은 bounded regular JSON string map으로 제한하고 raw parse 내용은 출력하지 않는다. env secret은 유지한다.
- screenshot.required 및 step.skipped를 추가했다. terminal outcome enum은 기존5개다.
- alpha.4에서 발견한 late evidence race는 고유 staging/확정 bytes/취소 검사/frozen snapshot으로 수정했다. 30ms step/200ms custom 수집 회귀와 관리 독립 probe에서 확정 PNG/hash/반환 result 불변을 확인했다.

관리 독립 수정 확인: `C:/Users/Domin/AppData/Local/Temp/aqa-manager-fixed-evidence-Nb9jVc/run_0bd3d537-a3c8-4650-96e6-bdf6561d9d38`. late custom adapter는 미등록 staging 파일을 남길 수 있지만 확정 artifact를 바꾸지 않는다. custom 코드 자체의 임의 경로 쓰기/동기 무한 점유는 격리하지 않는다.

## 인계와 미완료

Checker는 새 bundle/schema/pack hash를 고정한 뒤 authoring UI 및 step.skipped를 소비한다. 이전 alpha.4 계약으로 capture/authoring을 지원한다고 판단하지 않는다. [현재 구조 리뷰](architecture/engine-review.md)와 [authoring 규격](authoring.md)을 참고한다.

실제 Android/iOS 기기가 없어서 Appium 실기기 인수 task는 미완료다. TV, nested/dynamic loop, native capture, 모든 PII 자동 검출, 고급 canvas/iframe/shadow visual 검사, 원격 Agent lease/queue 실행은 완료 범위가 아니다. 다음 qa-agent-protocol은 별도 OpenSpec/Checker HTTP 계약을 먼저 합의하며 core의 독립 실행을 유지한다.
