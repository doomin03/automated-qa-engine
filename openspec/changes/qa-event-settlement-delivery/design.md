# Design

## Context

Engine main/8dd206a24657324c5675f4bb092d69c6ba366e7f 위에 완료된 alpha.9 변경이 미커밋 상태다. alpha.9 tgz SHA09d0669d247c18cf88c7967156f801d15e2a871eb2e2b6d740ba245d7ca933e6는 불변이다. 전체199회귀와 독립164파일/Checker3tests는 이전 버전 인수 증거이며 본 변경의 테스트가 아니다.

현재 packages/core/runtime/events.mjs는 durable append 뒤 bounded(onEvent, 실행 signal, remaining())를 호출한다. runner catch의 settlingFailure=true 전달도 같은 signal을 쓴다. 이미 abort된 signal은 callback 실행 전에 CANCELLED를 발생시키고 sink가 이를 ENGINE_ERROR/cleanup으로 기록한 뒤 observerFailed=true로 만든다. 그 결과 durable terminal은 존재하지만 정상 observer는 terminal을 받지 못한다. CLI는 durable replay로 이를 보충한다. alpha.9 실제 취소와 별도 custom adapter 재현에서 확인했으며 adapter.endSession 실패라는 뜻은 아니다.

## Goals / Non-Goals

**Goals:** 정상 취소·시간 만료와 실제 observer 장애를 분리하고, 유한 종료 시간·최초 판정·durable 계약을 유지한다.

**Non-Goals:** cleanupErrors schema 재설계, 임의 callback의 동기 무한 루프 격리, CLI 강제 kill의 자손 종료 보장, Appium 실기기 성공 합성, TV/whitebox/recorder 구현, Checker 운영 pin 자동 승격.

## Decisions

### D1. 실패 정리 전달에 독립 예산

실행 중 event는 기존 run signal/deadline을 유지한다. 이미 실패가 확정된 step.finished만 실행 signal과 분리한 최대1000ms 전달 예산을 사용한다. terminal은 기존 별도1000ms 예산을 유지한다. 최대 추가 observer 대기는 실패 정리1초+terminal1초이며 adapter cleanup5초와 구분한다. 전체 run timeout을 연장하여 실행 action을 계속하는 의미가 아니다. 실패 증거 수집은 기존 별도 한도를 유지한다.

기존 실패 정리 callback이 거부되거나 미응답하면 observerFailed로 후속 호출을 중단하고 기존 sanitized ENGINE_ERROR를 cleanupErrors에 남긴다. 실제 장애를 무조건 삭제하는 방안이나 새 deliveryErrors 필드 도입은 제외한다. 이미 실행 중 callback에서 오류/미응답/취소가 발생한 observer를 다시 호출하지 않는다. 이미 취소된 run이 건강한 callback을 호출하기 전 오류로 바뀌는 경로만 제거한다.

### D2. 최초 판정과 정리 책임

assertion 실패 뒤 외부 취소나 observer 실패는 원래 failure를 바꾸지 않는다. 정상 취소는 CANCELLED, run budget 만료는 TIMEOUT/run을 유지한다. adapter.endSession 실패는 CLEANUP_ERROR로 계속 보존하며 Agent unknown/quarantine 의미를 바꾸지 않는다. 파일 append/schema 실패를 observer 오류로 숨기지 않는다. result 저장 이후 terminal callback 실패는 기존 API ENGINE_ERROR rejection이며 immutable 결과는 수정하지 않는다.

### D3. 기존 change와의 정합

qa-runtime-resilience의 실패 callback 취소 요구는 당시 실행 AbortSignal로 전달도 즉시 중단하는 의미다. 이번 후속 요구는 실패 판정 이후 전달을 별도1000ms로 제한하므로 해당 callback 안에서 추가 abort해도 즉시 중단 대신 유한 전달 종료를 기다린다. 이 차이를 공개 문서와 테스트에서 명시한다. 실행 중 observer abort 의미는 그대로다. spec sync 시 기존 요구의 일반 문구를 무비판적으로 합치지 않고 이 후속 경계를 반영해야 한다.

### D4. 최소 계약 영향과 인수

필드/enum/서명/sequence는 그대로다. 정상 취소의 불필요한 ENGINE_ERROR가 없어지고 건강한 API callback이 terminal을 추가 수신하는 관측 변화가 있다. CLI는 실시간 출력 또는 replay 중 한 번만 각 sequence를 내보내야 한다. stdin cancel exit5, 전달 실패 exit3 및 durable 판정을 구분한다. schema bytes 고정 검사, 공개 패키지 설치 및 실제 Chromium PASS/FAIL/cancel을 다시 확인한 새 runtime만 소비시킨다.

authoring bundle은 runtimeVersion을 포함하므로 alpha.10부터 파일명에 runtime을 포함한다: qa-authoring-0.1.0-draft.1-engine-0.1.0-alpha.10.json. alpha.9의 qa-authoring-0.1.0-draft.1.json은 불변 보존한다. 소비자는 authoring-release.json의 artifact를 정본으로 읽고 package contracts/releases 안의 안전한 단일 상대 파일명인지 검사해야 한다. Checker 기존 installer에는 contractVersion 기반 하드코딩이 있어 담당자가 metadata 소비로 수정한다. 모든 소비자가 이미 대응한다고 가정하지 않는다. 기존 alpha.9 metadata도 동일한 읽기 계약으로 지원한다.

## Risks / Trade-offs

- 실패 정리 observer가 멈추면 추가 최대1초 대기한다 → 예산 명시·reject/hang 회귀로 검증한다.
- callback의 동기 무한 점유는 Promise timeout으로 중단하지 못한다 → 기존 신뢰 경계를 유지하고 보장하지 않는다.
- 정상 취소 cleanupErrors[]로 바뀌어도 실제 OS 후손 종료를 증명하지 않는다 → 실제 browser 연결 종료·소유 PID 관측과 Appium unknown 판정을 각각 검증한다.
- 현재 API 소비자가 terminal 미수신에 의존할 수 있다 → 새로운 runtime/version으로 배포하고 정상 event 순서와 중복 방지 계약을 문서화한다.

## Migration Plan

관리 설계 승인 후 집중 반례→구현→전체 verify→alpha.10 후보 독립 설치→관리 hash→Checker 별도 소비 순서로 진행한다. 이전 아카이브/사용자 Agent state/운영 pin은 수정하지 않는다. 현재 단계는 초안이며 모든 신규 task는 미완료다.
