# 저장소 조사 기록

조사일: 2026-10-24 (Asia/Seoul). 작업 시작 시점의 상태이며 원격 최신성 확인과 로컬 파일 확인을 구분한다.

## 입력과 작업 범위

사용자 지침: C:/Users/Domin/Downloads/automated_qa_codex_instructions/automated_qa_codex_instructions의 Markdown 8개를 읽었다.
최신 요청에 따라 기획·설계·구조·저장소 설정(P0)을 먼저 작성한다. 지침의 P1~P6 구현 요구는 로드맵과 미완료 OpenSpec tasks에 보존한다.

## 실제 저장소

| 저장소 | branch / HEAD | 초기 파일·상태 | 원격 확인 |
| --- | --- | --- | --- |
| engine | main / unborn, HEAD 없음 | .git만 존재, 사용자 변경 없음 | origin 조회 성공, heads 없음 |
| checker | main / 60b32ecdcbd9508865bae0cbd0a99cfacdec51ed | HEAD tree 비어 있음, clean; 마지막 커밋 chore: clear project for rebuild | origin/main 동일 SHA |
| scratch-3d 현재 checkout | feature/server-web-app-openspec / 3ead9aa8bb51ca7a4f8c9e6245532ef9c36b5028 | clean, 읽기 전용 | 변경하지 않음 |
| scratch-3d 참조 | 로컬 remote-tracking origin/feature / 325ca653fe213eb02b1b1e6e4fd7edc147f71721 | git show / ls-tree로 파일 확인 | git ls-remote 인증 실패, gh도 로그인 없음; 최신 원격 SHA 미확인 |

로컬 feature 브랜치는 없다. main이나 현재 checkout을 feature로 간주하지 않았다.
엔진 worktree는 현재 checkout 하나다. Checker에는 현재 checkout 외에 orca의 잠긴 detached 준비 worktree와 sunstar worktree가 있다. 이 둘을 수정하거나 삭제하지 않았다.
첫 커밋/새 branch/worktree/원격 push/merge는 수행하지 않는다.

## 참조에서 확인한 사실

근거는 모두 위 origin/feature SHA의 파일이다.

| 항목 | 실제 확인 | 채택 또는 제외 |
| --- | --- | --- |
| package.json + package-lock.json | 현재는 root npm/Vite/TypeScript 프로젝트 | engine의 최소 Node tooling에 npm 패턴 채택 |
| apps/*, packages/*, pnpm-workspace.yaml, turbo.json | 해당 SHA에 구현 파일 없음 | 이미 구현된 모노레포라고 기록하지 않음 |
| openspec/changes/refactor-server-web-app-monorepo/design.md | apps/server (Nest), apps/web (React FSD), apps/app (Flutter), packages/contract, api-client, api_client_dart, typescript-config 목표 설계 | 비어 있는 Checker의 기본 경로로 해당 설계를 채택; 앱 생성은 P2 이후 |
| 위 change tasks.md | 모노레포 구현 tasks 전부 미완료 | 실행/빌드 성공의 증거로 사용하지 않음 |
| openspec/config.yaml | spec-driven, 한국어, 구조 제목과 SHALL/MUST 영어 | 양 저장소 채택 |
| proposal/design/tasks/specs + .openspec.yaml | change 독립 디렉터리, ADDED Requirements, WHEN/THEN scenarios | 양 저장소 채택 |
| integration.md | counterpart 경계·의존 순서, OpenSpec 1.14.2 strict 명령 | 계약 우선 통합 규칙과 도구 버전 채택 |
| AGENTS.md | 사용자 수정 보존, 소유권, 명시적 병행 요청에서만 worker | QA용 규칙을 새로 작성; 게임용 agent/branch/port는 복사하지 않음 |
| Three.js/Rapier/script-engine/game domain | 참조 프로젝트 고유 기능 | QA에 복사하지 않음 |

Checker의 pnpm/Turbo는 참조의 **목표 설계에서 채택한 결정**이다. 기존에 동작하던 Checker 구조를 복원했다는 의미가 아니다.
참고 저장소의 Git index, ref, working tree에 쓰기 작업을 하지 않았다.

## 개발 환경

- Windows PowerShell, Node 24.18.0, npm 11.16.0 확인.
- pnpm/OpenSpec 전역 명령 없음. 저장소 고정 버전과 npx bootstrap을 사용한다.
- Dart/Flutter는 PATH에서 찾지 못했다. 설치 위치 전체 검색이나 SDK 설치는 수행하지 않았다.
- OpenSpec 1.14.2의 실제 init --help를 확인하고 각 저장소에서 init --tools codex --profile core --language Korean 실행.
- init 결과: 저장소별 .agents/skills 아래 6개 skill 생성, Codex용 slash command 생성 없음, spec-driven config 생성.
- pnpm 10.34.8과 Turbo 2.11.10은 npm registry에서 존재를 확인하고 고정했다. 앱 프레임워크 버전은 아직 확정하지 않는다.

## 남은 확인

- 인증 가능한 환경에서 scratch-3d 원격 feature 최신 SHA와 로컬 참조 차이 확인.
- P1 Dart core + Node Playwright runner spike, SDK/IPC/cleanup/배포 검증 후 실행 언어 ADR 확정.
- P2 Flutter SDK/Windows build toolchain, Nest/React/OpenAPI 생성기 버전 조합 검증.
- 브라우저 실행·서버 로그인·실기기 테스트는 P0 검증 대상이 아니며 아직 수행하지 않았다.

