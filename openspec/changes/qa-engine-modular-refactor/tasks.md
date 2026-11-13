# Tasks

## 1. 기준과 구조 인수

- [x] 1.1 baseline223소스/79package SHA와 독립37runtime+4type inventory를 대응시켜 전체 파일 분류표를 고정하고 누락0을 검사한다; 유지 이유와 테스트 근거를 기록한다.
- [x] 1.2 AST dependency gate와 순환/금지layer/computed dynamic/missing worker 반례를 구현한다; static import와 process/resource edge를 구분하고 신규 파일 자동 검사 및 명시 예외 정책을 문서화한다.

## 2. Core domain과 입력 계획

- [x] 2.1 version/actions/canonical/immutable leaf를 분리하고 기존 exports를 유지한다; prefixed/raw hash와 freeze/clone 차이, action 순서, 무부작용 import 회귀 및 타입 검사를 통과한다.
- [x] 2.2 compiler의 target/reference/node/graph/definite assignment 검증을 분리한다; alpha7 대비 plan의 version 외 deep equality/hash·최초 오류 코드/순서와 기존 core/capture 테스트를 통과하고 구조 문서를 갱신한다.
- [x] 2.3 documents/Blueprint XML/Authoring XML·direct input/finite expansion 책임을 분리한다; 기존 입력 강도·escaping·sourceMap·repeat/capture 의미 및 정상/악성 roundtrip 회귀를 통과한다.
- [x] 2.4 bounded IO/containment·PNG·design references를 분리하고 기존 facade를 유지한다; UNC/symlink/font/CRC·사이즈·worker 취소 및 이미지 검사 회귀로 역할 차이 보존을 확인한다.

## 3. 실행과 adapter 수명

- [x] 3.1 runner의 deadline/events/report/evidence/interpreter 책임과 상태 소유를 분리한다; normalized events/result와 primary failure·late artifact·1000nodes/256cap·run/node/cancel/observer 회귀를 통과하고 상태 소유 다이어그램을 갱신한다.
- [x] 3.2 Playwright session/locator/action/assertion을 분리한다; public fields/type·route/font/readiness·secret capture·실제 launch/cancel/cleanup·비동기 단언과 디자인/UX 전체 회귀를 통과한다.
- [x] 3.3 Appium configuration/transport/session/element/assertion/PNG 경계를 분리한다; API/type/action order·protocol·budget·unknown session·cancel 회귀를 통과하며 실기기 미검증 문구를 유지한다.

## 4. CLI 조립

- [x] 4.1 command catalog/dispatcher와 document/authoring/diagnostics 구현을 분리한다; 기존 명령/인자/출력/exit 및 document CLI의 adapter 미로딩을 검증하고 public entrypoint 경로를 유지한다.
- [x] 4.2 실행 config/secret·adapter factory·Suite·durable replay를 좁은 경계로 분리한다; Windows unread/EPIPE/취소/terminal 및 installed bin 회귀를 통과하고 운영 문서를 정합한다.

## 5. Optional Agent

- [x] 5.1 별도 담당이 store facade와 state lock/codec/model/journal을 분리한다; v1/v2·quota·model/ACK/pending·single writer·crash5경계·downgrade/no-repeat 회귀와 실제 bytes 보존을 검증하고 모듈 역할을 기록한다.
- [x] 5.2 supervisor의 claim/execution/recovery/release를 분리한다; 모든 페이지 reconcile·old owner·mixed recovered/receipt·lease cancel·새 실행 금지 반례와 기존 실제 child/HTTP fixture 회귀를 통과한다.
- [x] 5.3 materialize policy/immutable resources/native config와 reporting events/complete/artifacts/historical를 분리한다; allowlist·hash·containment·sent highwater·ACK loss·정확 manifest/receipt 검증을 통과한다. 유지 config/lease/child/transport/protocol/errors의 근거도 문서화한다.

## 6. 생성·패키징·전체 범위 마감

- [x] 6.1 contract/type 생성의 pure render와 check/write, test-package의 pack/install/fixture/report 단계를 정리한다; 기존 명령 경로·deterministic drift와 타입 소비를 검증하고 schema/Agent HTTP bytes 불변을 확인한다.
- [x] 6.2 모든 유지/변경 runtime/type/script/test와 신규 파일을 최종 inventory에 대응시킨다; readability·금지의존·실제 package 포함·역사 spike 유지 및 공개/구조 문서 링크 검사를 통과한다.

## 7. 통합 인수

- [x] 7.1 alpha7 대비 normalized public API/plan/events/CLI 의미 동등성 및178기준과 신규 전체 verify를 통과한다; cold/steady/출력·취소 성능 창을 분리 측정하고 악화가 있으면 근거를 기록한다.
- [x] 7.2 alpha8/draft2 새 bundle/XML과 별도 candidate tgz를 만들고 외부 프로젝트의 공개 API/CLI/bin/타입·실제 웹/Agent·protocol을 검증한다; 모든 설치파일 SHA와 alpha7 frozen 불변을 확인한다.
- [x] 7.3 관리 actual hash/결과 대조와 Checker 격리 소비를 완료한 동일 tgz bytes를 최종 고정한다; 후보 이력·미검증 모바일/운영 범위와 전체 모듈 대응표를 인계한다.

## Workflow follow-up

- 2026-11-07 중간 근거: 입력/작성42, runtime/capture26, adapter/browser/design47, Agent20, CLI/control/service30 집중 검사 각각 PASS(중복 포함). 독립 공개 차등21과 import25, 성능60표본, 수명6개 PASS. state14+신규2 및600operation exact journal 차등 PASS. source coverage223/223, 기존runtime37/type4 누락0. 최종 전체 verify와 후보 설치는 별도 게이트로 남긴다.
- artifacts/modular-refactor-20261107/source-coverage.json, artifacts/modular-refactor/final-summary.json, STATE-REFACTOR.md와 공개 차등 기록을 사용한다. 최초 adapter 변환 문법 실패와 수정 후 재실행은 docs/validation-alpha.8.md에 구분했다.
- 최종 전체188/188 PASS와 candidate-1 외부 설치148파일 SHA 대조를 완료했다. 최초 전체187/188 실패는 실제 정체 전 취소 fixture였으며 제품 의미를 바꾸지 않고 관측 barrier를 보완한 뒤 전체 재검증했다. 후보 tgz SHA4215662445780eeecd016ad6acf2a7b2c5e16b9a4e62cf8ae88e30ee0452e77f. 관리·Checker 격리 소비와 동일 bytes 최종 고정은7.3에서 별도 인수한다.
- 최종7.3: 관리 source/installed148파일 및33결과/44증거 직접 대조 PASS. Checker 격리 설치·공개 타입·실제 Flutter Service2tests/7runs와 analyze PASS, 관리자가7결과/terminal·artifact를 재확인했다. candidate-1을 동일 bytes로 artifacts/package/0.1.0-alpha.8에 고정했으며 verification.promotedFrom에 출처를 남겼다. 기본alpha.6과 frozenalpha.7은 그대로다.19/19 완료는 이번 구조·호환 범위이며 미해결 성능 비용 및 실기기/운영 미검증을 docs/validation-alpha.8.md에 남긴다.

- 제품 apply는 위 명세 strict와 관리 상세 검토 후 시작한다. 사용자에게 이미 승인된 리팩터링 범위를 다시 확인받지 않는다.
- commit/push/publish/archive 및 Checker 기본 pin 변경은 수행하지 않는다.
