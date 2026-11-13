# Proposal

## Why

alpha.9의 정상 취소는 이미 취소된 실행 signal 때문에 실패 정리 callback을 호출하지 못하고 ENGINE_ERROR를 cleanupErrors에 기록한다. 정상 callback도 이후 terminal을 받지 못하므로 독립 API 소비자가 정상 취소와 실제 전달 장애를 구분하기 어렵다. 실제 재현은 artifacts/engine-gap-20261112/cancel-probe.json에 보존했다.

## What Changes

- 실행 중 observer와 실패 판정 이후 정리 전달의 예산을 분리한다. 정상 취소/전체 timeout 자체를 전달 실패로 기록하지 않고 건강한 observer에 정리·terminal을 전달한다.
- 실제 callback reject/미응답의 sanitized 진단, 최초 실패, durable sequence/result 및 adapter cleanup 오류는 그대로 보존한다.
- 공개 API/CLI의 실제 PASS/FAIL/cancel·출력 정체 회귀와 독립 tgz 소비를 검증한다. CLI replay는 계속 필요하며 변경하지 않는다.
- 원본 로드맵의 미구현 기능, 실기기 인수, spec sync/archive를 별도 gap 표로 기록한다. 이 change를 전체 로드맵 완료로 보고하지 않는다.

## Capabilities

### New Capabilities

- `qa-event-settlement-delivery`: 실행이 이미 끝난 이후 callback 전달의 유한 예산과 진단 경계. 기준 specs가 아직 비어 있으므로 기존 qa-runtime-resilience change와의 의미 변경을 design에 명시한다.

### Modified Capabilities

없음. 기존 기준 spec가 없으며 진행 중 change의 역사 요구사항을 덮어쓰지 않는다.

## Impact

예상 변경은 core runtime event sink, lifecycle/CLI/package 소비 회귀 및 공개 문서다. 새 API/DSL/HTTP 필드나 의존성을 추가하지 않는다. runtime alpha.10 신규 로컬 아카이브를 제안하며 실행 contract 0.3.0-draft.2, authoring contract 0.1.0-draft.1, Agent HTTP schema bytes를 유지한다. runtime/bundle bytes/hash는 새로 발행하고 alpha.9 및 이전 고정 파일을 보존한다. 구현·버전은 관리 검토 후 적용한다.

- dependsOn: qa-runtime-resilience, qa-engine-service-hardening, qa-engine-modular-refactor, qa-reusable-document-authoring
- counterpartRepoChange: Checker의 후속 소비 change는 관리자가 지정; 기존 qa-multi-terminal-workbench alpha.9 인수와 분리
- acceptanceCriteria: 건강한 observer의 cancel/timeout terminal 수신, 진짜 callback 장애·cleanup 장애 보존, CLI exit/replay 및 독립 설치 실검증
