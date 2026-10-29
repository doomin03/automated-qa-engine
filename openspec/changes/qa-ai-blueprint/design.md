# Design

## Context
사용자가 기능 중심 개발과 다양한 AI CLI의 선언형 QA 입력을 요청했다.

## Goals / Non-Goals
GUI는 작성/검토/진행 시각화, 엔진은 schema/graph/실행 정책을 소유한다. 모델 SDK/외부 agent 자동 실행은 이번 범위가 아니다.

## Decisions
JSON Schema 정본, YAML 지원, XML은 엄격한 한 가지 구조로 변환한다. 임의 스크립트/eval/DTD는 없다. 화면 좌표는 metadata.presentation에만 저장한다. run events는 runId/attempt/sequence/nodeId로 연결한다.

## Risks / Trade-offs
AI 생성 오류는 구조 검증으로 막을 수 있지만 테스트 의도의 적절성은 사용자가 검토한다. 화면 디자인은 이후 변경 가능하다.

