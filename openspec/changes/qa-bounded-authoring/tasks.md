# Tasks

## 1. Authoring input

- [x] 1.1 JSON/YAML/XML 입력과 authoringXml을 구현하고 중복 XML/DTD/entity/깊이/예약 키/1MiB 및 CDATA round-trip 테스트와 docs/authoring.md로 검증한다.

## 2. Finite expansion

- [x] 2.1 repeat count/body/ID/edge/byte 한도와 deterministic sourceMap을 구현하고 다중 incoming/외부 branch/연속 repeat/충돌/잘못된 그래프/실패 후 unvisited 테스트로 검증한다.

## 3. Integration

- [x] 3.1 작성 XML → 확장 Blueprint XML → 실제 Playwright 반복 실행의 고유 event/result/hash를 확인하고 protocol-free 실제 browser 증거 및 OpenSpec strict 결과를 기록한다.
- [x] 3.2 parent의 alpha.5 schema 한도 통합 후 256 초과 및 정확히 1000 nodes/1001 거부 경계 검증을 실행하고 전체 package/CLI 소비 인수와 연결한다.

## Workflow follow-up

- schema/public types/CLI/exports/릴리스 version/hash는 Engine 담당자가 통합한다. alpha.4 산출물에 공개 완료 기능으로 넣지 않는다.
- archive/commit/push는 수행하지 않는다.
