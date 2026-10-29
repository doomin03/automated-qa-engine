# alpha.2 검증과 관리 인계

2026-10-29, Engine 전담. `qa-user-web-desktop-handoff` OpenSpec 명세 관리 검토 후 구현했으며 7/7 task를 실제 검증했다. Engine는 독립 Node ESM 패키지로 유지한다. 사용자 웹·Flutter·서버 코드는 수정하지 않았다.

## 변경과 호환성

- 사용자 Blueprint XML export/import, 속성 whitespace·CDATA 의미 보존, 혼합 XML/중복 singleton/미정의 속성 거부를 추가했다. 고정 데모만이 아닌 지원되는 사용자 정의 graph/action/selector/target을 처리한다.
- package 이름 기반 core API 및 `/playwright` adapter export, 공개 `.d.ts`·schema 타입 생성/drift 검사, 사용 문서·독립 consumer 예제를 제공한다. package import는 browser/session/child process를 시작하지 않는다.
- onEvent reject/미응답/취소 이후 callback 전달을 중단하고 durable events/result 및 cleanup을 진행한다. terminal callback 실패는 이미 저장된 판정을 보존하며 API는 sanitized ENGINE_ERROR로 reject한다. 실패 증거 3초/cleanup 5초 제한을 검증했다.
- engine runtime은 `0.1.0-alpha.2`, schemaVersion은 기존 v1, contractVersion은 `0.1.0-draft.1`을 유지한다. 기존 alpha.1 bundle/tgz는 보존했다. 신규 runtime dependency는 없으며 TypeScript 6.0.3은 검증용 devDependency다.

## 실행한 검증

| 명령 | 결과 |
| --- | --- |
| `node --test tests/xml.test.mjs` | 4/4. 사용자 왕복/악성XML/파일보존/실제 XML CLI PASS·FAIL. |
| `node --test tests/public-api.test.mjs` | 2/2. package명 core 소비, 구체 runner 없이 core import, import 시 process 생성 금지. |
| `node --test tests/lifecycle.test.mjs` | 7/7. 실제 callback reject/무응답/cancel/terminal 오류 및 hanging evidence cleanup. |
| `npm run test:package` | tgz 별도 설치 후 API PASS/FAIL/cancel, 설치 CLI XML PASS(exit0)/FAIL(exit1), ordered events/result/evidence hash, 정상 TS 타입검사 및 잘못된 사용 거부. |
| `npm run verify` | exit0. foundation, OpenSpec strict 4개, bundle/XML/type drift, Node tests 39/39. 실패/스킵 0. |

독립 consumer: `C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-UGuWHu`.
package 이름 import가 해당 consumer의 node_modules에 설치된 파일로 해석됨을 확인했고 sibling Engine/Checker 소스 import를 사용하지 않았다. 설치된 package.json의 aqa bin 대상으로 CLI를 실행했다.

실제 산출물은 consumer의 `reports/`에 있다.

- API PASS: `run_52e7d4a1-0328-44ee-9d08-9ac32165c805`.
- API FAIL: `run_5f8c2960-526a-4041-a4a9-9b184a850cdf`.
- API cancelled: `run_7ad175ad-1dab-457d-922a-e6eb0e087123`.
- 설치 CLI XML PASS: `run_73394171-c2c1-484d-b175-e8d9e794f3f5`.
- 설치 CLI XML FAIL: `run_81c5ecbb-dc9b-4065-a7ae-fe94951d1ea2`.

각 실행에 blueprint/plan/events/result/evidence를 보존했고 PASS/FAIL screenshot bytes의 hash를 검증했다. 전체 기계 판독 증거는 이 저장소 `artifacts/package/verification.json`, package 파일 목록은 `artifacts/package/pack-manifest.json`이다.

## 고정 배포 식별

| 종류 | 경로/식별 |
| --- | --- |
| runtime tgz | `artifacts/package/automated-qa-engine-0.1.0-alpha.2.tgz` |
| tgz SHA-256 | `5478fae0b40b973a3f4529efc940575edb5f273821d7d5b8ca1b8a651cb0df28` |
| npm integrity | `sha512-hPU7l66x2vFMmV5DyMXuRTaZUAvYaUsj9C7+ZKN4MtgYiddLtar6IjABareHn6OdT1N6zKX1FI1BEKyrFquHFQ==` |
| schema bundle | `contracts/releases/qa-contract-0.1.0-alpha.2.json` |
| bundle SHA-256 | `3d5be41a5b996dfada78b3aea5f8e17fa889e1c90a0e00c566eb00c717c00715` |
| XML fixture | `contracts/releases/qa-blueprint-0.1.0-alpha.2.xml` |
| XML byte SHA-256 | `bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729` |
| fixture Blueprint snapshot | `sha256:1e24d3c9a5217aa706a02a4ef7620192673f508bb19fbd2e661a13e9756589a1` |

pack에 public API/adapter 타입·schema 타입·소비 예제·API/XML 사용 문서가 포함됨을 목록으로 확인했다. tgz 검증 이후 패키지 포함 파일을 수정하지 않았으며 이 내부 인계와 OpenSpec 완료 기록만 갱신했다. metadata는 관리·Checker 담당에게 전달했고 Checker pin은 변경하지 않았다.

## 남은 범위와 Git

Engine branch `main`, HEAD 없음(unborn), 작업 파일은 기존과 마찬가지로 untracked다. 이번에도 새 commit/push/worktree/원격 npm publish는 수행하지 않았다.

Appium/TV, 원격 Agent/lease/idempotency, 중앙 서버는 미구현이다. Flutter의 MVVM/Provider 기본 구조 작업과 Engine alpha.2 실제 통합 인수는 별개다. Checker의 alpha.1 pin 유지/갱신 및 웹→Desktop 전체 인수는 관리 에이전트가 결정한다. OpenSpec 기준 sync/archive는 하지 않았다.

같은 process의 동기 무한 callback이나 custom adapter가 만든 외부 자원의 강제 종료까지 보장하지 않는다. 미해결 consumer Promise를 강제로 취소할 수는 없지만 Engine 대기 시간·결과 기록·session cleanup은 제한한다. Windows CLI OS 강제 kill과 graceful AbortSignal 인수는 구분한다. GitHub Actions 원격 실행은 수행하지 않았다.
