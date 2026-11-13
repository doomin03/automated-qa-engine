# Engine 잔여 범위 조사 — 2026-11-12

조사 기준은 main `8dd206a24657324c5675f4bb092d69c6ba366e7f` 위의 alpha.9 미커밋 작업 및 고정 tgz다. alpha.9 작성 API/CLI, 전체199회귀, 독립 패키지164파일과 Checker 작성 계약 소비는 완료했으며 다시 미구현으로 분류하지 않는다. 원본은 사용자 Downloads의 지침8MD, 최신 역할 분배와 현재 코드/OpenSpec를 함께 대조했다.

## 실제 결함과 보완

`runtime/events.mjs`의 실패 정리 전달이 취소된 실행 signal을 그대로 사용하여 callback 호출 전 CANCELLED를 ENGINE_ERROR/cleanup으로 바꾼다. 건강한 observer까지 비활성화하므로 API에는 terminal이 오지 않는다. durable JSONL/result는 존재하고 CLI replay는 보충한다. alpha.9 실제 취소 증거에 이어 `artifacts/engine-gap-20261112/cancel-probe.json` custom adapter/API 반례에서 endSession1회 성공, callback sequence1–4, durable1–6, terminal 미수신을 확인했다. 이는 실제 세션 정리 실패가 아니라 전달 정책 결함이다. 신규 `qa-event-settlement-delivery`에서 최소 보완하며 기존 진짜 callback 장애와 CLEANUP_ERROR를 유지한다.

## 미완료 분류

| 항목 | 근거와 실제 상태 | 처리 경계 |
| --- | --- | --- |
| Appium Android/iOS 실제 인수 | qa-appium-adapter task3.2 미완료, protocol 및 lost-session/cancel unknown 회귀는 구현·검증됨 | emulator/device/Appium driver, iOS macOS/Xcode 환경 필요. 입력 계정·app/device 범위를 받기 전 실제 장치 실행 성공을 주장하지 않음 |
| OpenSpec sync/archive | qa-flow-schema-core 3.1, qa-playwright-runner 3.1 미완료; 기준 openspec/specs는 비어 있음 | 실행 기능 누락이 아닌 행정/정합 작업. 후속 change의 수정 요구까지 통합해야 하므로 단순 복사/체크 금지 |
| 서버/Agent alpha.6, Desktop 새 버전 | Engine alpha.9는 로컬 preview; 서버 exact pin/lease policy와 별도 | 새 runtime 검증→관리 hash→Checker 서버/Agent/Desktop 실제 교차 인수→명시 전환. Engine 단독으로 운영 pin 변경 불가 |
| 다른 PC 배포 | tgz/bin/API/types와 독립 임시 소비는 실제 확인; 외부 PC 설치·브라우저 cache/OS/toolchain/실운영 검증 아님 | 패키지 호환 런타임·브라우저 설치·원본 hash·stdout drain/cancel·local scope 전달 필요. MSI/Setup/원격 npm 게시를 이미 제공한다고 하지 않음 |
| TV | 원본 Stage5의 플랫폼별 후속 adapter. 현재 target/capability에서 지원하지 않음 | 기기·개발자 모드·접속 정책 조사 후 별도 OpenSpec. 일반 TV 하나로 합치거나 placeholder 성공 금지 |
| Whitebox | 원본 Engine 문서 CodeTestAdapter 계약 및 Stage5 허가된 repository/CI 실행 구상, 현재 전용 공개 adapter 없음 | sandbox/명령 allowlist/권한/증거 계약 선행 필요. 임의 shell을 기존 Flow에 추가하지 않음 |
| Recorder | 원본 Stage6 later, 현재 사용자 동작 recording→Flow 생성 기능 없음 | capture 변수 기능과 recording은 별개. opt-in 수집·locator·민감 정보 정책 및 별도 명세 필요 |
| 고급 Suite/다중 시스템 | 현 run-suite 순차 local 참조와 Agent ordered cases는 있음. raw Suite XML·태그/매트릭스 확장·여러 target/session 교차 비교는 없음 | 원본 TestSuite 구상과 이후 단일 target 승인 범위를 구분. 별도 계약/사용 시나리오 확인 없이 이번 결함 보완에 추가하지 않음 |

## 문서 정합과 운영 한계

system-design.md는 alpha.8/표의 alpha.7을, execution-contract-v0.1.md는 alpha.2/P4 예정 문구를 남기고 있다. 역사 문서의 상태/정본 링크를 명확히 해야 하며 현재 스키마·공개 README/버전별 인수를 우선한다. 단일 target/session, compile-time bounded repeat, custom adapter 신뢰, callback 동기 무한 점유 미격리, 강제 parent kill의 자손 cleanup 미보증, Agent tombstone/디스크 유한 용량은 명시된 제약이다. 추가 반례·운영 요건 없이 모든 제약을 자동 기능 확대하지 않는다.

이번 조사에서 제품/고정 아카이브를 수정하지 않았다. 새 change 초안과 재현 artifact만 추가했다. 신규 구현 완료 여부는 해당 change tasks와 검증 문서로 별도 기록한다.
