# alpha.10 통합 runtime 인계

Engine 단독 인수는 [alpha.10 검증](../validation-alpha.10.md)을 따른다. 이 문서는 Checker 서버/Agent와 Desktop에 같은 검증된 버전을 적용하기 위한 제안이며, 실제 운영 승격을 수행했다는 기록이 아니다. 후보는 artifacts/package/0.1.0-alpha.10/candidate-1 아래의 동일 tgz 바이트로 고정했다. commit/push/원격 npm 게시 및 기존 사용자 state 변경은 하지 않았다.

## 유지한 계약과 바뀐 소비 조건

- execution contract0.3.0-draft.2, authoring0.1.0-draft.1, Agent HTTP0.1.0-draft.1과 schema bytes는 그대로다. 두 release bundle의 내용 차이는 engineVersion이며 각각 새 SHA를 사용한다.
- 작성 bundle 파일명은 authoring-release.json의 artifact로 조회해야 한다. alpha.9 정적 파일명 조합은 새 runtime에 맞지 않는다. metadata는 안전한 상대 파일명·package containment·실제 SHA를 검증한 뒤 읽는다.
- API 정상 취소·전체 timeout 뒤 건강한 observer는 실패 정리와 terminal을 받는다. 실패 정리 전달의 최대1초는 action 실행 예산을 늘리는 것이 아니다. 실제 observer 장애·CLI replay·CLEANUP_ERROR/Agent unknown은 유지한다.
- 기존 결과에 engineVersion alpha.6/8/9가 기록됐다고 새 버전으로 다시 쓰지 않는다. 기존 job/lease의 exact pin도 소급 변경하지 않는다.

## 권장 인수 순서

1. 관리 archive/bundle/설치167파일 SHA gate 후 Checker의 별도 ignored 설치에 동일 tgz를 넣는다. 이전 실행 설치와 Windows Release를 보존한다.
2. Desktop 작성 catalog/template/compose, XML validate/plan/run, invalid/unsupported, stdout/stderr·취소·terminal 경계를 실제 소비한다. authoring metadata 변경과 이전 alpha.9 metadata 지원을 함께 확인한다.
3. 서버 EngineContractService의 새 exact runtime/bundle 설정으로 별도 테스트 DB를 사용한다. 신규 published pinned case/Suite를 전달하고 기존 lease 자료를 새 버전으로 변조하지 않는다.
4. 별도 전용 Agent state/config에서 Desktop 종료 상태의 claim→실제 browser 조작→events/artifact→complete/receipt를 검증한다. 취소·전송 재시도·재시작·unknown quarantine 및 중복 side effect 방지도 실제 HTTP 인수로 확인한다. 기존 운영 Agent state를 삭제하거나 강제 재실행하지 않는다.
5. 같은 pin으로 실제 앱 Release를 빌드·기동하고 설치 파일/manifest를 대조한다. 서버·Agent·Desktop의 버전 일치와 각 제품 인수 결과를 확인한 뒤 명시적으로 전환한다. 복구 시에도 이미 발행한 실행 identity를 재사용하여 다시 실행하지 않는다.

## 다른 PC와 남은 환경

Node24.18 이상25미만/npm11, 검증한 아카이브와 metadata, Playwright Chromium 설치 및 실행 권한, 쓰기 가능한 report/state 공간이 필요하다. 외부 프로세스 소비자는 stdout/stderr를 drain하고 stdin cancel 후 유한 종료를 기다린다. Appium은 별도 서버·driver·장치·허용 app/device 설정이 필요하며 Android/iOS 실제 인수는 아직 미완료다. remote session 종료가 불명확하면 자원을 자동 재배정하지 않는다.

임시 독립 소비 프로젝트는 다른 물리 PC의 OS/네트워크/보안 설정까지 검증하지 않는다. MSI/Setup 제작과 원격 npm publish도 이 후보 인수에 포함되지 않았다. 이 경계와 실제 장치/TV/whitebox/recorder는 [잔여 범위](remaining-engine-gaps-20261112.md)로 남긴다.
