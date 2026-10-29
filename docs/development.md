# 개발 환경과 실행

Node 24.18.0 / npm 11.16.0 / Playwright 1.64.1 / OpenSpec 1.14.2를 고정한다. npm ci --ignore-scripts 후 npx --no-install playwright install chromium을 실행한다. Linux CI는 --with-deps 옵션으로 브라우저 시스템 의존성도 설치한다.

## 명령

- npm run verify: foundation, strict OpenSpec, unit/CLI/실제 browser 테스트.
- npm run demo: 로컬 사이트의 실제 PASS/FAIL과 artifacts 생성.
- npm run contracts:bundle: 공개 JSON Schema/예제 bundle과 SHA-256 생성.
- node scripts/build-contract.mjs --check: bundle drift 검사.
- node packages/cli/aqa.mjs doctor: 런타임·browser 설치·capability 확인.
- npm pack --pack-destination artifacts/packages: 로컬 설치용 tgz 생성. 원격 publish는 하지 않는다.

## 입력과 출력

JSON/YAML/XML Blueprint를 권장한다. standalone Flow/TC는 --selectors FILE --target-manifest FILE로 실행 맥락을 지정한다. Suite는 cases에 파일 경로를 적고 parallelism=1로 순차 실행한다.
run --json stdout은 JSONL events, 입력 오류는 단일 error JSON이다. 최종 run.finished의 resultPath는 해당 run 폴더 기준이다. exit: 0 성공, 1 테스트 실패, 2 입력 오류, 3 환경 오류, 4 차단, 5 취소.

secretRef login.password는 AQA_SECRET_LOGIN_PASSWORD 환경 변수 또는 --secrets-file의 JSON 키로 주입한다. secrets 파일은 추적하지 말고 .env.local 등 Git ignore 경로를 사용한다. 이 버전은 secret 변수를 사용하는 실행의 스크린샷을 비활성화하여 앱이 값을 화면 다른 곳에 표시하는 경우도 저장하지 않는다.
Production 환경은 --allow-production이 있어야 실행한다. allowedOrigins는 session request 정책으로 적용한다. 임의 shell/eval 액션은 없다. 브라우저 네트워크 정책은 OS sandbox를 대체하지 않는다.

## OpenSpec와 Git

현재 engine change 3개: qa-flow-schema-core, qa-playwright-runner, qa-ai-blueprint. 실제 검증 완료 항목만 체크한다. planning artifact 완료와 제품 인수를 구분한다. 아직 archive하지 않았다.
Engine main은 첫 커밋 전이다. 기존 사용자 자산과 scratch-3d를 변경하지 않았으며 commit/push/worktree 생성은 수행하지 않는다.

