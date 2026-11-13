# alpha.8 구조 리팩터링 인수

현재 상태: **전체 회귀·외부 설치·관리 교차검토·Checker 격리 소비 완료, 동일 candidate-1 bytes 최종 고정**. 운영 승격은 하지 않았다. counterpart는 Checker `qa-engine-refactor-compatibility`, Engine change는 `qa-engine-modular-refactor`다.

## 기준과 계약

- main / HEAD ecdb8ff87b1b45b93a38921a44d36c8adb068cd8의 기존 dirty 구현을 보존했다.223소스와 alpha.7 설치79파일의 SHA 및 원본 snapshot을 artifacts/modular-refactor-20261107/baseline에 기록했다.
- alpha.7 고정 tgz SHA-256:0199b719baaf2f41c46b6e6cb07dc8ddd80464923c639ed724cae612f31c80c3. 기존 package/bundle/XML을 덮어쓰지 않았다.
- runtime 0.1.0-alpha.8, execution contract 0.3.0-draft.2. schema bytes와 Agent HTTP pin 8c25e3c853f3b8d24003464d2ddc55a20675b7ac3f741a46c238a50ce4149490은 유지한다.
- alpha.8 bundle SHA-256:638d48f182d12819ebd167d42457c7dceaa90928abb38c32a4867e3c94b10763. XML SHA-256:bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729. 이는 contract 생성 결과이며 패키지 최종 인수와 다르다.

## 진행 중 확인한 근거

- OpenSpec strict 통과 후 apply했다. [모듈 책임 문서](architecture/modular-refactor.md)에 전수 분류와 의존 규칙을 기록한다.
- 입력/계획/작성/XML/CLI42개, runtime/capture/evidence/초기AST26개, adapter/browser/design47개, Agent protocol/recovery/reporting/supervisor20개, CLI/control/service30개 집중 검사가 각각 통과했다. 이 수치는 중복 테스트를 포함하므로 전체 고유 테스트 수로 합산하지 않는다.
- 초기 adapter 변환의 constructor 추출·export 문법 오류가 집중 검사에서 발견됐다. 변환을 고친 뒤 adapter/browser/design47개를 다시 실행해 통과했다. 최초 실패를 성공으로 기록하지 않는다.
- state 담당의 기존14개+신규2개 검사,600operation/36checkpoint/20reopen 차등에서 API·오류·status·journal bytes가 alpha.7과 일치했다. v2를 alpha.6 reader로 열면 거부되는 경계도 보존했다.
- 생성기 분리 직후 alpha.7 bundle/XML/type `--check`가 기존 bytes와 일치했다. 이후 alpha.8 새 version/bundle만 생성했다.
- AST 경계 반례는 comments/strings, dynamic import, facade 전이, self/file URL, CommonJS loader, namespace/alias Worker, process edge를 검사한다. 독립 감사의14개 반례를 보완 후 모두 기대대로 판정했다.
- 최종 runtime 포맷은 별도 state 담당 파일을 제외했다. architecture 검사는 npm run verify에 연결했다.

## 인수 범위와 유지한 한계

독립 공개 동작 차등·성능, 최종 전체 회귀와 외부 tgz 설치, 관리자 hash·artifact 대조, Checker 격리 소비 및 동일 tgz bytes 최종 고정을 완료했다. Checker default pin·Windows Release·서버·운영 Agent는 alpha.6을 유지한다. alpha.6의 실제 Nest 서버 인수를 alpha.8의 새 서버 인수로 바꾸어 쓰지 않는다. 모바일 실기기, TV, 다중 target/session, raw Suite XML 및 실제 운영 배포는 추가 완료 범위가 아니다.

## 독립 차등·성능 창

공개 동작21개에서 differences0/unexpectedRuntimeErrors0, import25개에서 실패·관측 실행 부작용0을 확인했다. 실제 CLI/API/Chromium 전후60표본은 모두 기대 결과를 냈다. 측정 창은2026-11-07 06:14:14Z–06:15:30Z이며 runtime/schema/package/lock 시작·종료 SHA drift0이다. 정확한 비교 corpus와 source hash는 artifacts/modular-refactor의 감사 기록을 따른다.

| 같은 창의 중앙값(각5회) | alpha.7 | alpha.8 | 해석 |
| --- | ---: | ---: | --- |
| validate |866ms|586ms|문서 명령의 adapter 로딩 제거 |
| plan |883ms|586ms|문서 명령의 adapter 로딩 제거 |
| 실제 Chromium256 wall |1450ms|1549ms|약6.8% 증가, 전체 실행이 빨라졌다고 주장하지 않음 |
| API1000 run |955ms|994ms|약4.1% 증가 |

수명6개는 외부 강제종료0·관측 잔류PID0이며 TIMEOUT/run, 출력 전달 infra_error, cancelled 구분을 유지했다. 짧은1500ms 정상출력1000노드는 최종 감사 artifact 기준689노드 진행 뒤 TIMEOUT/run이었다. 소표본·순차 실행·캐시 효과 및 parent-only 자원 계측 한계를 가진 개발 머신 측정이며 운영 성능 보증은 아니다.

실제 Chromium 실행의 parent peak RSS 중앙값은180,324→211,900KiB로 약17.5% 증가했다. browser/child 전체 합산이 아니며 동일 명령의 부모 지표다. 책임 분리와 문서 경로 개선을 전체 실행 시간·메모리 개선으로 확대하지 않는다. 최종 감사 원문은 artifacts/modular-refactor/FINAL-AUDIT.md 및 final-summary.json에 보존했다.

관리 검토는 정량 SLA가 없는 이번 구조·호환 인수에서 이 비용을 수용했다. Chromium wall/RSS와 API 내부 시간 증가는 미해결 성능 추적 항목이며 원인을 확정하지 않았다. 전체 process tree 메모리·부하·캐시 영향을 분리한 원인 조사는 후속 범위다. 전체 성능 최적화 완료를 뜻하지 않는다.

전수 source-coverage.json은 기준223/223, 기존runtime37/37, type4/4, 누락0을 확인했다. 현재 runtime은104개이며 각각 분리된 역할과 기존 facade를 포함한다. module 수 증가를 품질 자체의 증거로 사용하지 않는다. 최종 전체 verify는 위 차등 창 종료 후 실행하여188/188 PASS했다.

## 최초 전체 검증과 취소 fixture 보완

첫 npm run verify는188개 중187 PASS/1 FAIL이었다(verify-alpha8.log). 실패한 unread stdout 취소 테스트는 저장 event 파일이64KiB를 넘으면 pipe가 막혔다고 가정했지만, Windows pipe와 Node 부모 Readable의 여유 버퍼 때문에 아직 출력 가능한 시점에 취소했다. 기대 exit3 대신 정상 취소 exit5였다.

원본 실행은 Temp/aqa-service-dljvsH/cancel/run_42d52e4c-dba1-403a-8a4e-fb0e46f5ba87에 보존했다. visited164, events76102bytes, outcome cancelled, cleanupErrors=[], terminal run.finished/cancelled를 직접 확인했다. 상세는 first-verify-cancel-evidence.json이다. 최초 실패를 제품 성공이나 전달 실패로 바꾸지 않는다.

runtime과 exit3 기대는 그대로 두고, 테스트만64KiB 이후 event 진행이250ms 이상 멈추고 result가 아직 없는 barrier를 사용하게 고쳤다. 전체 watchdog 안에서 정체를 관측하지 못하면 테스트는 실패하며 interval을 정리한다. 같은 집중 테스트를3회 연속 실행해 모두 PASS한 뒤 전체 verify-alpha8-final.log 재검증을 시작했다. 측정107개 runtime/schema/package/lock bytes는 바꾸지 않았다.

## 최종 전체 회귀와 외부 패키지 후보

- 최종 `npm run verify`:188/188 PASS, fail0, skip0,123487.5424ms. foundation·AST 경계·전체 OpenSpec strict·계약/타입 drift 검사를 함께 통과했다. 원본 로그는 artifacts/modular-refactor-20261107/verify-alpha8-final.log다.
- `AQA_PACKAGE_STAGE=candidate-1 npm run test:package`: exit0. 원본은 artifacts/package/0.1.0-alpha.8/candidate-1/verification.json 및 pack-manifest.json이다. source와 독립 설치의148개 배포 파일을 실제 SHA로 대조했다.
- tgz SHA-256:4215662445780eeecd016ad6acf2a7b2c5e16b9a4e62cf8ae88e30ee0452e77f. 이름은 automated-qa-engine-0.1.0-alpha.8.tgz이며 위 후보 폴더에 보존했다.
- sibling 저장소가 없는 Temp/aqa-package-consumer-FA4gMt에서 공개 package import, TypeScript 양성/음성 타입 검사, npm이 설치한 `aqa` bin의 version/help, CLI/API 실제 Playwright PASS/의도한 FAIL/취소, design·authoring·1000노드/timeout/출력 정체를 검증했다. Appium은 protocol fixture이며 실제 기기를 뜻하지 않는다.
- optional Agent는 독립 HTTP fixture에서 ACK 재전송·순서 있는 case·재시작 격리·실제 Chromium 조작 횟수를 확인했다. 이번 후보가 기존 Checker 실제 Nest 운영 서버와 연결됐다는 의미는 아니다.
- 후보 생성 이후 제품·공개 문서 payload를 동결했다. 관리·Checker 인수 뒤 동일 tgz bytes를 최종 경로로 복사했으며 새 pack으로 해시를 바꾸지 않았다.

## 관리·Checker 인수와 최종 고정

관리자는 후보 설치148개 파일의 목록·actual/source SHA, 측정107개 source SHA, schema/HTTP와 alpha.7 고정 artifact 불변을 직접 대조했다. 외부 consumer와 Agent fixture의33개 result/terminal 쌍 및44개 증거 파일도 outcome·sequence·SHA가 일치했다.

Checker는 별도 설치에서148개 파일, 공개 root/playwright/appium exports, TypeScript 정상 호출 exit0·잘못된 호출 exit2를 확인했다. 실제 Flutter Service2개 테스트의7실행에서 XML 왕복/실행, PASS/의도한 FAIL, 지연 렌더링,1000노드 visited999/unvisited997, paused stream 취소107ms를 인수했다. analyze도 PASS했다. 관리자는 그7개 result/terminal 쌍과 실제 artifact SHA 및 기본alpha.6/기존alpha.7 자료 보존을 별도로 확인했다. 근거는 관리 작업 공간 coordination/artifacts/alpha8-package-gate.json, alpha8-checker-consumption-gate.json 및 Checker의 격리 소비 보고서다.

최종 파일은 artifacts/package/0.1.0-alpha.8/automated-qa-engine-0.1.0-alpha.8.tgz이며 SHA-256은 후보와 같은4215662445780eeecd016ad6acf2a7b2c5e16b9a4e62cf8ae88e30ee0452e77f다. 같은 폴더 verification.json의 promotedFrom은 candidate-1의 원본 archive·verification·해시를 가리킨다. pack-manifest.json도 그대로 복사했다. 원격 publish·commit·push, 기존 사용자 Agent state 변경, Checker 기본 pin 승격은 하지 않았다.
