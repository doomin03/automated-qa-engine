# Tasks

관리자 D1–D7 승인 및 strict PASS 후 구현과 Engine 인수를 완료했다. 전체199회귀, 독립 설치와 관리 hash 대조, Checker 별도 설치164파일 및 실제 Dart 작성 계약3tests를 통과했다. candidate-1과 동일 bytes를 최종 로컬 경로에 고정했다. counterpart: Checker `qa-multi-terminal-workbench`; Checker native final/앱 Release 인수는 별도로 진행 중이며 서버 alpha.6 pin은 유지한다.

## 1. 작성 계약과 기준 고정

- [x] 1.1 별도 authoring schema/catalog/release 정의와 공개 타입을 작성하고 정상·오류 envelope/schema/type 검사로 D1–D5 필드 동등성을 검증한다. 실행/Agent schema 및 frozen alpha.6/alpha.8 SHA 기준을 기록한다. (집중 schema/hash 테스트, tsc 정상0/오류2, 이전18파일 및 두 frozen tgz SHA 일치)
- [x] 1.2 기존 Dart 실제 실행 fixture를 Engine 인수 fixture로 고정하고 source provenance/hash를 기록한다. 반복 instance·branch exit label·capture/secret 참조의 기대 canonical Blueprint/sourceMap을 확인한다. (`tests/fixtures/compose-*`, focused Dart golden 7사례 및 독립 비교 7/7 PASS)

## 2. 순수 템플릿과 합성

- [x] 2.1 네 template catalog와 pinned bindings 생성 API를 구현하고 완전/누락/미지 binding, secretRef, native 설정 거부, empty 생성과 compose 거부 테스트를 통과시킨다. 공개 API 사용 문서에 지원 범위를 기록한다. (docs/document-authoring.md, API 및 독립 CLI31검사 PASS)
- [x] 2.2 source/hash 검증, 순차 outer/internal DAG 합성, namespace/참조 치환과 immutable sourceMap을 구현한다. 기존 Dart golden 차등 및 입력 순서 변경 결정성/중복·충돌·target/reference 제한 테스트를 통과시킨다. (Dart 7/7 및 결정성 PASS)
- [x] 2.3 기존 XML parse/export와 compiler로 왕복 snapshot을 검증하고 JSON source도 동등하게 처리한다. sourceMap synthetic node/실제 node identity와 getter·크기·깊이·node/edge 한도·진단 비밀값 비노출 회귀를 통과시킨다. (집중 API7 및 독립 경계17/17 PASS)
- [x] 2.4 pure API에 browser/Appium/network/secret resolver 호출이 없고 독립 병렬 요청이 상태를 섞지 않음을 검증한다. architecture boundary 검사와 sourceFile UI 보강/실행 미승인 설명을 문서화한다. (public-root side-effect guard, architecture PASS)

## 3. 공개 CLI와 파일 경계

- [x] 3.1 templates list/show/create 및 compose CLI를 strict args/기존 output transport에 연결한다. 오류 exit/채널·무관 flag·catalog pin·JSON envelope와 기존 template/preset/expand 회귀를 검증하고 재현 명령을 문서화한다. (CLI 집중4 및 독립31 PASS; 기존 명령 전체 회귀는4.2에서 확인)
- [x] 3.2 bounded 입력 및 exclusive --out/선택 document-root 경계를 구현한다. 원본·기존 파일 보존, traversal/absolute/UNC/symlink 또는 junction escape, read/쓰기 실패 정리 테스트로 파일 정책을 검증한다. (실제 Windows junction/UNC 사전거부·existing 원문 보존·읽기/쓰기 오류 PASS)

## 4. 독립 패키지와 교차 인수

- [x] 4.1 runtime alpha.9와 별도 authoring contract를 generation/drift/files manifest에 포함한다. 실행 schema/Agent 바이트 및 frozen archive 불변, 공개 exports/types/bin과 배포 문서/예제 포함을 검증한다. (candidate-1 설치164파일 source/actual SHA 대조 및 계약/이전18파일 보존 PASS)
- [x] 4.2 npm run verify 전체 회귀를 통과하고 별도 tgz 설치 consumer에서 API/bin/type/catalog/hash/compose/XML 왕복을 검증한다. 생성과 별도 명시 실제 웹 PASS/의도 FAIL/stdin cancel의 result/terminal/evidence 및 sourceMap 대응을 기록한다. (199/199, 외부 consumer 기존검증+신규compose5runs/6PNG PASS; artifacts/package/0.1.0-alpha.9/candidate-1/verification.json)
- [x] 4.3 검증된 archive/runtime/execution contract/authoring contract/bundle/file SHA를 관리자에게 인계하고 Checker 별도 설치 소비 결과를 확인한다. 동일 bytes 최종 고정, strict/foundation/diff와 실제 미지원·미검증 상태를 기록한다. (관리 checker-install-verification.json 및 Dart 작성 계약3tests PASS; artifacts/package/0.1.0-alpha.9/promotion.json에 후보와 최종 archive/report SHA 일치 기록; 취소 진단 및 앱 Release 별도 인수는 docs/validation-alpha.9.md 참조)

## Workflow follow-up

- 기존 기획 완료 보고서는 제품 완료로 바꾸지 않는다. archive/운영 pin 승격/원격 publish는 이번 구현 인수와 별도 절차다.
