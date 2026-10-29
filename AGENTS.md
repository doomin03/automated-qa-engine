# Automated QA engine

- 먼저 README.md, docs/architecture/repository-audit.md, docs/architecture/system-design.md와 작업 대상 OpenSpec change를 읽는다.
- 문서는 한국어로 작성한다. OpenSpec 구조 제목과 SHALL/MUST는 영어로 유지한다.
- 현재 범위는 P1 로컬 실행 preview다. Node CLI/Playwright/AI Blueprint 입력이 구현되어 있으며 원격 Agent와 모바일은 후속 단계다.
- Engine는 독립 패키지의 실행 스키마와 interpreter/adapter/API/CLI를, Checker는 사용자 웹(시나리오 배포·진행 확인), Flutter Desktop(개별 테스트 개발·실제 실행 요청), 서버/업무 상태를 소유한다.
- Flutter UI, Slack 인증, 중앙 사용자 DB를 engine에 도입하지 않는다. Dart/Node spike 후 ADR 001에서 Node ESM 런타임을 선택했다.
- scratch-3d는 읽기 전용 참조다. origin/feature의 설계와 실제 구현을 구분하고 인증 실패를 추측으로 메우지 않는다.
- 현재 npm lockfile과 고정된 OpenSpec 1.14.2를 사용한다. 전역 Codex 설정이나 사용자 자격증명을 변경하지 않는다.
- 계약 변경은 engine 명세 → engine 구현 및 contract test → release 고정 → checker 연동 순서다.
- 실제 검증한 tasks만 [x] 처리한다. P1/P2 구현 전 change를 archive하거나 openspec/specs에 구현 완료 기준으로 복사하지 않는다.
- 실행 결과와 업무 진행 상태를 분리하고 unsupported/infra_error/unrun을 성공으로 처리하지 않는다.
- shell 실행을 Flow 기본 액션으로 허용하지 않는다. secretRef만 커밋하고 artifact/log에는 실제 비밀값을 남기지 않는다.
- 사용자 수정 보존. reset --hard, clean -fd, force push 금지. 원격 push/merge는 별도 요청이 있어야 한다.
- worktree는 명시적 병행 작업 시에만 검토하며 유효한 HEAD가 필요하다. 이번 설정은 기존 checkout에서 수행한다.
- 검증: npm run verify. foundation/OpenSpec과 실제 Chromium 테스트를 포함한다. 실행 전 Playwright browser를 설치한다.

