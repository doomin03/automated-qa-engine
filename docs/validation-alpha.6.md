# Engine alpha.6 검증·인계

2026-10-31, Engine main/HEAD ecdb8ff87b1b45b93a38921a44d36c8adb068cd8 이후 미커밋 작업. alpha.5와 이전 배포 및 candidate-1/2는 불변이다. commit/push/npm publish 없음. 실제 서버 교차 인수와 최종 독립 설치 검증을 완료한 local-preview 인계다. Checker 최종 UI/Windows 전체 인수와 Android/iOS 실기기 검증을 대신하지 않는다.

## 최종 고정 artifact

| 구분 | 값 |
| --- | --- |
| Runtime / execution contract | 0.1.0-alpha.6 / 0.3.0-draft.1 |
| Agent HTTP protocol | 0.1.0-draft.1 |
| tgz | artifacts/package/0.1.0-alpha.6/automated-qa-engine-0.1.0-alpha.6.tgz |
| tgz SHA-256 | 33dbcacea025fb98a52fb0411af05cb113bc85e47e84a98463912b6aace1acef |
| npm integrity | sha512-P5Pk8ReXLwsh09Lzql5Qw7ZE3CFNpi8ipk9R02DuDLuKoJlXZKDBRlP7KJkMboV8wM4kFoYmQzuXxxAyDrDC+g== |
| 실행 bundle bytes SHA-256 | 1f880001f8c653e51527ee9f92c5728aa7517b61adfb6c158d218a4a0542ed8d |
| XML fixture SHA-256 | bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729 |
| HTTP artifact SHA-256 | 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490 |
| pack-manifest.json SHA-256 | 7f8c379bdc1078588b4e183a3f073cadfe05ddf6445737972e161df5194a17a1 |

최종 소비 프로젝트는 C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-0g9kd5다. `npm run test:package`가 실제 pack/install 후 기존 API/CLI 26 runs, TypeScript valid/invalid, 별도 Agent 프로세스의 replay/ordered/restart matrix를 통과했다. Agent fixture 자료는 C:/Users/Domin/AppData/Local/Temp/aqa-agent-consumer-vBHU8E다. 정확한 결과는 tgz와 같은 디렉터리의 verification.json에 있다.

candidate-comparison.json은 설치된 74개 파일을 candidate-2와 최종 package 사이에서 SHA로 대조한다. 차이는 README.md와 docs/agent.md 두 공개 문서뿐이며 실제 Nest 인수에 사용한 제품 코드는 동일하다. 최종 tgz 자체도 새 독립 설치 검증을 수행했으며 이전 후보 해시를 최종 값으로 바꾸어 적지 않았다.

```powershell
npm install C:/workspace/QA/automated-qa-engine/artifacts/package/0.1.0-alpha.6/automated-qa-engine-0.1.0-alpha.6.tgz --ignore-scripts
npx --no-install aqa --version
npx --no-install aqa --help
npx --no-install aqa agent --config C:/absolute/operator-agent.json
```

Agent 토큰은 config의 tokenEnv에 해당하는 프로세스 환경변수로 제공한다. config/state/credential은 운영자가 소유하고 npm 설치만으로 Agent가 시작되지는 않는다.

## Candidate-1 계약과 역사 증거

- runtime 0.1.0-alpha.6 / execution contract 0.3.0-draft.1 / Agent HTTP protocol 0.1.0-draft.1.
- tgz: artifacts/package/0.1.0-alpha.6/candidate-1/automated-qa-engine-0.1.0-alpha.6.tgz
- candidate SHA-256: 917c6ae07acdbec7227bec96443f7be7be23cc7f6d4586f0be12db93c54deee1
- candidate integrity: sha512-jcSlTYDZ6e03hUm8wg4Fu54aQEw8qEdopUwGlqR10eNpPL9/8L9AqGcyuQnymG5hqz83bsW0V3yE6H7v/k4D2g==
- 실행 bundle bytes SHA-256: 1f880001f8c653e51527ee9f92c5728aa7517b61adfb6c158d218a4a0542ed8d (contracts/releases/qa-contract-0.1.0-alpha.6.json).
- XML fixture SHA-256: bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729.
- Checker HTTP artifact SHA-256: 754b35b51db3c75584d1d01343cdcecfa5c2c27674f86b60fac54a53d356f9de, contracts/agent-protocol/pin.json으로 별도 고정.

서로 다른 해시를 교환하지 않는다. Agent의 engineContractSha256은 npm tgz나 runtime manifest 해시가 아니라 위 실행 bundle bytes 해시다. candidate metadata는 최종 release pin에 사용하지 않는다.

## 확인한 인수

`AQA_PACKAGE_STAGE=candidate-1 npm run test:package`에 해당하는 PowerShell 환경 설정 후 실제 npm pack/install을 수행했다. sibling source 없는 소비 프로젝트는 C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-AKY7aP다. 기존 API/CLI/시각·UX/Appium protocol/반복·capture/secret screenshot **26 runs**와 올바른/틀린 TypeScript 소비가 통과했다. native protocol 테스트는 실제 기기 인수가 아니다.

별도 설치 Agent CLI + HTTP fixture 인수 root는 C:/Users/Domin/AppData/Local/Temp/aqa-agent-consumer-wDtMWA다.

| 시나리오 | 실제 확인 |
| --- | --- |
| claim 응답 및 event ACK 유실 | 같은 claimRequestId 재시도 2회, 대상 POST side effect 1회, PASS/16 events/PNG 1개 전송 |
| ordered Suite | FAIL→PASS 순서, 서로 다른 runId 2개, 대상 POST 2회, 28 events/PNG 2개 |
| side effect 직후 Agent 강제 종료→restart | 대상 POST 1회, claim 1회 유지, 재시작 exit3/quarantine, 결과/cleanup 성공 합성 없음 |

candidate 디렉터리의 verification.json/pack-manifest.json이 정확 설치 경로와 결과를 기록한다. 위 HTTP fixture는 실제 Checker Nest 서버와 구분한다.

추가 source 회귀는 store/lease/transport/policy/materialize/child/supervisor/report/recovery 테스트다. unsent ACK/부분 atomic ACK, 누락·중복 artifact receipts와 2차 complete 응답 변조, historical byte batching·동일 requestId 재생·durable receipt, closed receipt 복구 후 oldowner release, unknown server lease의 재실행 거부를 검증했다. 실제 Chromium child cancel과 Suite 실패 중단/취소 후 후속 case 미실행도 통과했다. 관리자는 두 reporting 반례를 수정 전후 독립 재현하여 거부를 확인했다.

## Candidate-2

- tgz: artifacts/package/0.1.0-alpha.6/candidate-2/automated-qa-engine-0.1.0-alpha.6.tgz
- SHA-256: 0dce64bf4b3be2bab09cce56c96e394f1cfa759eae3b7535f5fbc7e8ae908c45
- integrity: sha512-p9Mm67iB29A5f84QVqtLgRFvHrGEnyylPdJteUvGCmf5NnQj1GLfgHFnwQ3xcWf+teijyTaMmLZ9JnC0jhulig==
- HTTP protocol SHA: 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490. 실행 bundle과 XML hash는 candidate-1과 동일하다.
- 독립 설치 consumer: C:/Users/Domin/AppData/Local/Temp/aqa-package-consumer-lt29oA. 기존 26 runs, 올바른/틀린 TypeScript 소비 PASS.
- 별도 Agent HTTP fixture: C:/Users/Domin/AppData/Local/Temp/aqa-agent-consumer-1IIC1A. claim/event ACK 유실 후 counter1, ordered FAIL→PASS/counter2, side effect 직후 강제 종료→restart exit3/counter1 PASS. 실제 Checker 서버 증거와 구분한다.

## 실제 Checker 서버 candidate-1 matrix

독립 설치 AKY7aP의 Agent CLI와 실제 Nest 서버 4320을 사용했다. Flutter Desktop 프로세스는 실행에 사용하지 않았다. 아래 각 경우 대상 fixture의 POST side effect는 정확히 1회였고 Agent exit0, deliveryClosed, cleanup confirmed를 확인했다. 서버 담당자가 DB의 receipt ACK, resource 해제, PNG bytes/hash를 독립 대조했다. 자료는 Engine artifacts/agent-nest-checkpoint 및 artifacts/agent-nest-matrix, Checker의 별도 server-verification.json에 보존한다.

| 경우 | execution 또는 lease identity | 실제 판정 |
| --- | --- | --- |
| 첫 PASS | lease af0ffb95-ba31-4b65-8238-cc9b184e0c13 | passed |
| 의도적 FAIL | execution 0b827e45-85c8-4774-a7e4-8642e45c6082 | failed |
| claim 응답 1회 유실 | execution 74124d7e-aa6f-4325-b02b-daac97cc44c0 | passed, 실제 조작 1회 |
| event ACK 1회 유실 | execution e518c47d-f795-4067-a7b3-5d896e81f6ff | passed, 실제 조작 1회 |
| 서버 취소→heartbeat→child stdin | execution 9d81c78a-18f3-49a0-b45d-d760209dea80 | cancelled |

취소 fixture 준비 중 unsupported action으로 미실행된 job과 즉시 assertion FAIL한 job은 취소 성공 증거에 포함하지 않는다. 해당 queue/상태 기록은 보존했고, 위 마지막 identity가 수정된 실제 취소 인수다.

## 검증 범위와 제한

candidate-1 이후 관리 검토로 confirmed204 idle journal checkpoint, idle owner PID/release 복구, 서버가 로컬 미확정 lease를 누락할 때 fail-closed, 명시 운영자 recovered 소비를 추가했다. candidate-2는 새 HTTP SHA8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490을 사용하며 candidate-1 bytes를 덮어쓰지 않는다. source 추가 회귀는 atomic replace 전후 crash 5경계, 한도40에서400 idle ops, actual CLI full journal exit3, nullable ref 검증, recovered-only/mixed receipt owner 및 livePID/잘못된 fence 거부다. 최종 artifact와 실제 서버의 해당 경로는 다음 인수에 기록한다.

- candidate-2 전체 npm run verify: **158 tests PASS, failed/skipped 0**, OpenSpec strict12/12, foundation/bundle/type drift PASS (약162.6초). candidate-1의 이전148 tests 기록과 구분한다.
- candidate-2 실제 서버 matrix는 아래와 같이 완료했다. 최종 README/공개 문서 정합으로 package payload가 변경되어 별도 final pack/install 검증도 완료했다. 후보 hash를 최종 hash로 재사용하지 않는다.
- 서버 queue/auth/resource registration/scheduling은 Checker 소유이며 Engine fixture 통과가 해당 업무 기능 완료를 의미하지 않는다.
- 실제 Android/iOS 기기가 없으므로 native Agent 실행·정리는 실기기 미검증이다. native infra_error와 강제 종료는 unknown/quarantine 정책이다.
- journal/자산 한도 및 자동 GC 없는 장기 운영 제한은 [Agent 문서](agent.md)에 있다.

## 실제 Checker 서버 candidate-2 matrix

설치 CLI는 lt29oA 소비 프로젝트의 package bin이며 서버는 별도 DB의 4321이다. target POST counter는 실제 Playwright tap의 부작용을 계수한다. Desktop은 이 실행에 관여하지 않는다. 서버 담당자는 .local/agent-demo-alpha6-candidate2/server-verification.json에 DB·artifact 교차 검증을 기록했다.

| 경로 | 실제 확인 및 자료 |
| --- | --- |
| 첫 PASS | execution dbdc85cd-13e4-4e2f-83b3-9f0e31de7b59, counter1, closed/confirmed |
| idle204→Agent kill→restart | 다른 state root의 같은 identity는 exit3 차단. 기존 state로 oldowner release 후 execution14c61ef2-0344-42fa-baee-5c560ab625d2 PASS/counter1 |
| ordered continue | execution1e94e8be-5d48-4849-9ae4-2b2a7afe9684, FAIL→PASS/서로 다른 runId/counter2 |
| stopOnFailure | executionc776f348-c6e8-479f-9ef5-2af1aea71970, 첫 FAIL/counter1, 후속 case 미실행 |
| Suite cancel | execution05c2369c-62ca-4eca-b0da-bb6ce936f503, 첫 cancelled/counter1, 후속 미실행 |
| recovered-only | crash7b9f2a64-6876-4fc4-857f-ec1e1d565ba0 counter1, restart exit3 후 operator fence6→7. 원래 cleanup unknown/receipt null/result 없음 유지. 새 executionaf23c385-aa1b-48c1-9d5b-3b5d38ea779b/fence8 PASS |
| closed A+recovered B 혼합 | A40dc55a8-abcd-4206-b213-647427014933의 실제 receipt ACK 유지, B320c0a40-0d3d-4823-9b2b-6c975d40cae0는 unknown/null 보존. 실제 qa_manager HTTP recovery fence10→11 후 새 ce6faabb-6596-44d1-b2cc-08357f2d3b12/fence12 PASS. A/B/new 각각 counter1 |
| 복구 멱등 HTTP | mixed requestId 재전송 시 같은 recovery b1902da3-836d-4b39-8a4a-18684ffe9036 반환 |

자료: artifacts/agent-nest-candidate2/matrix-all.json, matrix-recovered-finish.json, matrix-mixed-recovery.json. 첫 recover helper는 별도 서버 context의 monotonic map이 비어 만료를 확인하지 못해409였다. 제품 HTTP endpoint를 호출하도록 Checker가 helper를 고친 뒤 mixed를 처음부터 실제 HTTP로 검증했다. 초기 직접 helper와 HTTP의 서로 다른 payload 재전송은 성공 증거로 쓰지 않는다.

운영자 종료 확인 fixture는 이 harness가 직접 시작한 supervisor와 journal의 childPid를 사용했다. supervisor를 종료하고 해당 CLI child가 살아 있으면 Windows `taskkill /PID <childPid> /T /F`로 그 자식 process tree만 종료했으며 명령 성공과 CLI PID 부재를 확인한 다음 operator 확인을 보냈다. 개별 browser PID 목록이나 OS 밖 remote Appium session까지 조사했다는 증거는 아니다. 제품의 ownerProcessesStopped/externalSessionsStopped는 실제 머신·외부 session을 확인한 운영자의 신뢰 입력이며 HTTP true 값 자체가 종료를 증명하지 않는다. 새 빈 state root는 과거 PID/복구 근거가 없으므로 보수적으로 거부하며 정상 운영·재시작은 같은 durable root를 유지한다.

PNG 자산 인수는 artifacts/agent-nest-resource/verification.json이다. executioncb63f541-77fc-493d-8828-1742d814b452에서 서버 opaque resource1177ce29-5cb9-4376-ae1b-bb78fe66a1b8을 assets/baseline.png로 materialize했다. 420bytes/SHA b1eba2bd8b8eca4655f76e1c2de94771c326e54893569448d59bb7e46a34df77 대조 후 assertImage가 diffRatio0으로 PASS했고 baseline/actual/diff PNG3개와 check-report JSON1개를 전달했다.

게시·예약 인수는 artifacts/agent-nest-scheduled/verification.json이다. Checker의 독립 reviewer 검수→Blueprint publish→Suite006504d8-a048-45ce-9abb-6288701ed1d4 publish/pin→UTC schedule2bbb8fcd-df5a-4864-a53b-1a40a43e127a를 사용했다. Agent는 06:34:47Z부터 대기했고 due06:36:00Z 뒤 execution784b24cd-640c-4cc5-a7fe-190864127630/run_e5ded341-7d12-407e-b431-40f13d949816를 PASS/counter1로 실행했다. 서버 DB에서 동일 occurrence1개, 원본 Suite hash,16events,receipt ACK를 대조했다. 전송 후 프로세스 종료와 동일 state 재시작으로 closed receipt 복구/release까지 확인했다.

158개 전체 회귀 이후 tests/agent-child.test.mjs에 native POST/session 응답 유실과 DELETE 정리 timeout 인수를 추가했다. 해당 파일3tests PASS이며 실제 설치 CLI+HTTP fixture가 result를 보존하면서 Agent cleanupState를 unknown으로 반환한다. 이는 Android/iOS 실기기 인수가 아니다.

최종 검토에서 경로 인수 근거를 보강했다. tests/agent-protocol.test.mjs의 `Agent rejects UNC and absolute resource paths before requesting resource bytes`는 Windows UNC, slash UNC, Windows drive/backslash·slash, POSIX 절대 경로의 5가지를 정본 ResourceManifest 검사·Agent policy·materialize 경계에서 거부하고 다운로드 호출0회를 확인한다. 해당 파일5tests PASS. 기존 `fonts/test.woff2` materialize/hash/대소문자 충돌 회귀와 tests/design.test.mjs의 실제 Windows junction reference 거부, tests/input-evidence.test.mjs의 root 밖 absolute/TC junction 거부를 별도 근거로 사용한다. 이 추가는 테스트와 배포 제외 문서만 변경하며 고정 tgz를 다시 만들지 않는다.

artifact 응답 유실 범위는 혼동하지 않는다. 위 Engine 실제 Nest matrix는 claim/events 응답만 의도적으로 유실시켰고 PNG/JSON PUT은 정상 전송했다. 후속 실제 artifact ACK-loss는 Checker 서버 담당자가 최종 alpha6 tgz로 추가 검증했다: `.local/agent-artifact-loss-final/matrix-247e7680-ef18-4a4b-ad8f-64081b58e3f5/verification.json`. 첫 PUT을 서버 저장 후 응답만 파괴하고 complete에서 uploaded1/missing3을 조회해 나머지3개를 전송했다.4개verified/receipt ACK/실제 side effect1회, 동일 state 재시작 exit0을 관리자가 DB 독립 대조했다. 이미 저장된 PUT은 정확히 재전송을 생략했다. 서버4322/대상4337/proxy는 담당자가 종료했고 기존 frozen bytes는 변경하지 않았다.
