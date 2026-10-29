# 관리 에이전트 인계 — Engine

아래는 alpha.1 기준 인계 기록이다. 2026-10-29 이후 수행한 alpha.2 독립 패키지/XML/lifecycle 작업의 최신 결과는 [alpha.2 검증·인계](../validation-alpha.2.md)를 따른다.

확인일: 2026-10-29 (Asia/Seoul). 원본 지침은 `C:/Users/Domin/Downloads/automated_qa_codex_instructions/automated_qa_codex_instructions`의 README, CODEX_MASTER_PROMPT, ENGINE_CODEX_PROMPT, CONTRACTS_AND_EXAMPLES, PHASES_AND_ACCEPTANCE, WORKTREE_OPENSPEC_GUIDE다.

## 판정

P1 로컬 CLI 수직 슬라이스의 실제 브라우저 실행을 재검증했다. Checker 담당은 현재 계약을 고정하여 P2 로컬 연동 작업을 시작할 수 있다. 이는 Flutter 연동 완료, 정식 릴리스 게시, 원격 Agent 지원 판정이 아니다.

관리 에이전트는 원본 MD를 기준으로 업무 배정·교차 저장소 계약·단계 인수를 조정한다. Engine 담당은 이 저장소의 구현·검증을 소유하며 Checker 파일을 수정하지 않는다. 계약 변경이나 새 기술 결정은 관리 에이전트에 근거와 영향 범위를 먼저 전달한다.

## 원본에서 확정된 정책과 구현 결정

| 구분 | 기준 및 현재 적용 |
| --- | --- |
| 저장소 경계: 원본 고정 | Engine은 독립 저장소, Checker는 Flutter·관리자 웹·서버 모노레포. 엔진 소스를 Checker로 복사하지 않는다. |
| 실행 계약 소유: 원본 고정 | Engine이 정본 스키마를 소유. 계약 → Engine 구현·contract test → 버전/hash 고정 → Checker 소비 순서다. |
| 실행 모델: 원본 고정 | 선언형 Flow를 검증·compile·interpret한다. GUI는 실행 정의를 만들고 실행 결과를 표시한다. |
| 단계 인수: 원본 고정 | 조사 → OpenSpec → 작은 실행 단위 → 실제 검증. P1 CLI/브라우저 이후 P2 Flutter 통합, P3 협업, P4 예약/Agent 순서다. |
| 상태·보안: 원본 고정 | outcome/업무 진행/예약 상태 분리, unrun은 Checker 운영 평가값. 임의 shell 비허용, secret reference, 대상 allowlist, production opt-in, 미지원 성공 처리 금지. |
| 기존 자산: 원본 고정 | scratch 참조는 읽기 전용. 사용자 변경 보존. worktree는 선택 사항이며 유효한 HEAD가 필요하다. push/merge는 별도 요청이 필요하다. |
| 런타임: 구현 결정 | Dart→Node 실제 spike 뒤 [ADR 001](adr-001-runtime.md)에서 Node ESM을 채택했다. 원본은 Dart 검토를 요구하며 Dart 사용 자체를 고정하지 않는다. |
| AI 작성 입력: 추가 요구 반영 | JSON/YAML/XML Blueprint 입력은 [AI 작성 정책](../ai-authoring.md)에 명시했다. import/validate는 실행하지 않는다. AI 공급자 CLI를 Engine에 직접 내장하지 않았다. |

원본 CONTRACTS_AND_EXAMPLES의 타입 이름·예시는 제안이다. 현재 실행 가능한 형태는 [실행 계약](execution-contract-v0.1.md), [manifest](../../contracts/manifest.json), [정본 스키마](../../contracts/schemas/qa.schema.json)를 따른다. 원본의 모든 장기 요구사항이 현재 구현됐다는 뜻은 아니다.

## 저장소와 계약 식별

- 경로: `C:/workspace/QA/automated-qa-engine`, branch `main`, HEAD 없음(unborn).
- 기존 소스·문서·설정은 모두 untracked 상태다. 현재 worktree 하나이며 새 branch/worktree/commit/push는 만들지 않았다.
- Engine: `0.1.0-alpha.1`, contract: `0.1.0-draft.1`, 배포 상태: `local-preview`.
- 공개 교환 artifact: [qa-contract-0.1.0-alpha.1.json](../../contracts/releases/qa-contract-0.1.0-alpha.1.json).
- SHA-256: `b9e125e56685243c82ab7e90a2f574a2538e0ea014f23f6d4035ff75fd0953f6`.
- [release metadata](../../contracts/release.json)는 로컬 bundle을 식별한다. [manifest](../../contracts/manifest.json)의 원격 release tag/artifact/hash는 null이며 원격 릴리스는 없다.
- schemaVersion: `qa.flow/v1`, `qa.testcase/v1`, `qa.suite/v1`, `qa.selectors/v1`, `qa.target/v1`, `qa.runRequest/v1`, `qa.runEvent/v1`, `qa.result/v1`, `qa.capabilities/v1`, `qa.evidence/v1`, `qa.blueprint/v1`, `qa.plan/v1`.
- `qa.runRequest/v1` 스키마 존재는 원격 Agent 실행 transport가 구현됐다는 의미가 아니다.

## 이번 실행 증거

Windows / Node `24.18.0` / Playwright `1.64.1`에서 실행했다.

| 명령 | 결과 |
| --- | --- |
| `npm run verify` | exit 0. foundation, OpenSpec strict 3개, bundle drift 검사, Node tests 26/26 성공. 실패·스킵 0. |
| `npm run demo` | exit 0. 실제 Chromium PASS 1회와 의도적 assertion FAIL 1회를 각각 생성했다. |
| `node packages/cli/aqa.mjs doctor --json` | exit 0. browserInstalled=true, web/Chromium capability 보고. |
| `node packages/cli/aqa.mjs devices --json` | exit 0. chromium-headless 보고. 모바일·TV 가용성을 보고하지 않는다. |
| `Get-FileHash -Algorithm SHA256 contracts/releases/qa-contract-0.1.0-alpha.1.json` | 위 고정 hash와 일치. |

재현 산출물은 이 저장소 내부의 다음 디렉터리에 있다. artifacts는 Git에서 제외한 로컬 검증 증거다.

- PASS: `artifacts/run_9b10e90e-a708-4195-ba77-2c34c6667357/`.
- FAIL: `artifacts/run_3d646370-6b71-45ff-b10c-2cea3c94d74a/`; `ASSERTION_FAILED`, 실패 노드 `home`.
- 두 디렉터리에 `blueprint.json`, `plan.json`, `events.jsonl`, `result.json`, `evidence.json`, `evidence-0.png`가 존재한다.
- 실제 CLI 실패 테스트가 exit 1과 parseable JSONL을 검증한다. demo 자체의 exit 0은 PASS/의도적 FAIL 쌍을 올바르게 재현했다는 뜻이다.
- browser disconnect는 `RUNNER_CRASH`/`infra_error`, cancel은 `cancelled`, timeout과 secret 비노출·스크린샷 제외·branch 미방문도 테스트한다.

## Checker P2 실행 인계

Checker는 Engine 소스를 복사하거나 source 경로를 tracked `file:` dependency로 추가하지 않는다. 현재 bundle을 정확한 버전/hash로 검증하여 소비하고 실행 바이너리도 별도 고정한다. 원격 배포 전 로컬 CLI 경로는 사용자 환경 설정으로 관리한다.

개발 재현은 Engine 저장소에서 다음으로 수행한다.

```powershell
node packages/cli/aqa.mjs --version
node packages/cli/aqa.mjs validate examples/login.qa.json
node packages/cli/aqa.mjs plan examples/login.qa.json
node packages/cli/aqa.mjs demo
```

특정 Blueprint 실행은 해당 target 서버가 가동 중인 상태에서 다음 명령을 사용한다. 기본 예제 서버는 별도 터미널에서 `node examples/server.mjs`로 시작할 수 있다.

```powershell
node packages/cli/aqa.mjs run examples/login.qa.json --json --report artifacts
```

Flutter는 `node` 실행 파일과 `[절대 CLI 경로, run, 절대 Blueprint 경로, --json, --report, 절대 결과 루트]` 인자 배열을 사용한다. shell 문자열 조합이나 npm 배너가 섞인 stdout을 transport로 사용하지 않는다.

run stdout은 `qa.runEvent/v1` JSONL이다. `(runId, attempt, sequence)`로 처리하고 마지막 `run.finished`의 `resultPath`는 실행 디렉터리 기준 상대 경로다. 현재 경로는 `<report>/<runId>/result.json`이며 event 파일은 같은 디렉터리의 `events.jsonl`이다. 잘린 JSONL, sequence gap, 누락 terminal/result, 비정상 child exit를 성공으로 취급하면 안 된다. 원본 JSONL의 마지막 레코드 이전까지는 버퍼링/중복 처리를 포함한 Flutter 검증이 필요하다.

실제 exit mapping은 passed=0, failed=1, 입력/schema 오류=2, infra_error=3, blocked/unsupported/secret 누락/정책 거부=4, cancelled=5다. validate/plan/import는 실행을 시작하지 않는다.

## 지원 범위와 미완료 인수

지원: JSON/YAML/XML Blueprint, schema·DAG·selector·target 검증, branch, bounded timeout/retry/cancel, 런타임 secret resolution, Playwright web, local artifact/event/result, `launch/tap/input/clear/waitFor/assertVisible/assertText/assertValue/screenshot`.

미지원·미검증을 다음처럼 구분한다.

- P2 Flutter CRUD/drag-drop/undo/redo, CLI child lifecycle·불완전 JSONL·취소와 UI 결과 표시는 Checker의 미완료 인수다.
- Appium Android/iOS, TV, CodeTestAdapter 실행은 미구현/실기기 미검증이다. capability는 web만 광고한다.
- 원격 Agent, 인증/lease/idempotency/재연결 outbox, 예약 중복 실행 방지는 P4 후속이다.
- 생산 런타임은 Node 단일 프로세스이므로 Dart 부모↔Node child IPC 복구는 적용되지 않는다. 실제 browser disconnect 정리는 검증했지만 OS 강제 종료된 CLI를 Flutter가 복구하는 인수는 아직 없다.
- artifact 격리 테스트는 순차 반복 실행의 서로 다른 runId/hash를 검증한다. 동시 실행 부하나 OS crash 후 복구를 검증했다는 주장은 하지 않는다.
- 로컬 npm pack 설치·PASS/FAIL은 2026-10-24 [기존 검증 기록](../validation.md)의 증거다. 이번에는 재패키징/원격 게시를 하지 않았다. GitHub Actions 원격 실행도 이번 검증 대상이 아니다.
- OpenSpec task 현황: `qa-flow-schema-core` 8/9, `qa-playwright-runner` 9/10, `qa-ai-blueprint` 3/3. 첫 두 change의 spec sync/archive는 미완료이고 이번 감사에서 완료로 바꾸지 않았다.

다음 담당 작업은 Checker의 고정 계약 기반 Flutter 로컬 수직 슬라이스다. Engine는 P2에서 확인된 계약/실행 결함을 재현하고, 계약 변경이 필요하면 관리 에이전트 결정 후 Engine 검증을 먼저 진행한다.
