# Design

## Context

[저장소 조사](../../../docs/architecture/repository-audit.md)에 따라 빈 저장소의 기본 경계를 구성한다. 상세 목표는 [시스템 설계](../../../docs/architecture/system-design.md)와 [로드맵](../../../docs/planning/roadmap.md)을 따른다.

## Goals / Non-Goals

aqa validate/run/devices/doctor, local web fixture, Playwright adapter와 result/evidence 생성을 구현한다. Appium/TV 실제 구현과 GUI는 후속 단계다.

## Decisions

local credential-free 웹 fixture를 사용한다. stdout은 JSON/JSONL, 진단은 stderr, run/attempt별 artifact를 분리한다. ADR 001의 단일 Node runtime에서 browser process/session의 finally cleanup을 검증한다. 외부 Node runner IPC는 생산 구조에 없으며 JSONL 손상은 Checker 입력에서 검증한다.

- integrationId: automated-qa-foundation
- contractVersion: 0.1.0-draft.1
- dependsOn: qa-flow-schema-core의 검증된 schema/interpreter/Runner port
- counterpartRepoChange: automated-qa-checker/openspec/changes/qa-flow-editor
- phase: P1

## Risks / Trade-offs

Dart/Flutter 미설치, 원격 참조 최신성 미확인, engine 미발행 상태를 구현 완료로 간주하지 않는다. 실제 실행 인수 없이 mock/문서 검증만으로 tasks를 닫지 않는다.

## Migration Plan

기존 소스가 없으므로 대체 migration은 없다. 계약 fixture → 구현 → 실패 경로 → 실제 E2E → 릴리스 소비 순서로 진행한다. 사용자 worktree와 원격 Git은 변경하지 않는다.

## Open Questions

후속 단계에서 SDK/framework/driver의 정확한 버전을 실행 검증으로 결정한다. 현재 기능 명령과 제안 명령은 README에서 구분한다.

