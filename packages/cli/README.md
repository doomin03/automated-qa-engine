# CLI

설치된 `aqa --help` 또는 저장소의 `node packages/cli/aqa.mjs --help`로 사용한다. 검증·import/export/plan은 브라우저를 시작하지 않으며 실제 실행은 run/run-suite/demo로 요청한다.

```powershell
npm install ./automated-qa-engine-0.1.0-alpha.8.tgz --ignore-scripts
npx --no-install playwright install chromium
npx --no-install aqa --version
npx --no-install aqa doctor --json
npx --no-install aqa run my-test.xml --json --diagnostics stderr --control-stdin --report reports
```

alpha.3부터 --control-stdin을 명시한 run/run-suite는 UTF-8 JSONL 한 줄 `{"type":"cancel"}\n`을 받아 graceful 취소한다. Windows Desktop은 child.stdin에 쓰고 terminal/result의 cancelled 및 exit5를 확인한다. 취소 요청을 전송했다는 이유만으로 cancelled를 합성하지 않는다. 빈 EOF는 취소하지 않는다. Ctrl+C/SIGTERM도 기존 취소 신호로 처리한다.

제어 입력은 LF/CRLF, 정확한 type key만 허용한다. 한 줄 최대 4096 bytes, 수신 최대 65536 bytes다. 미완성 줄 EOF, unknown/추가 key, 비정상 UTF-8/JSON, 크기 초과는 원문 없이 INVALID_CONTROL 진단을 내고 실행을 ENGINE_ERROR/infra_error(exit3)로 중단한다. 이미 확정된 실패는 최초 판정을 보존한다. 첫 cancel 뒤 제어 listener를 닫고 명령 완료 시 stdin을 해제한다.

--diagnostics의 기본은 stdout(기존 호환), stderr 선택은 오류 JSON을 stderr로 보낸다. run --json stdout은 events이며 API가 취소로 observer 전달을 중단한 경우 해당 run의 저장 JSONL을 검증해 누락 sequence만 이어 출력한다. stdout EPIPE는 재전송을 반복하지 않고 전달 실패로 종료하며 디스크 결과는 보존한다. exit는 passed0/failed1/입력2/infra3/blocked4/cancelled5다.

내부 모듈은 aqa(entry), catalog/args/help(규격·인자·도움말), commands(문서/작성/진단 지연 dispatch), execution(설정/adapter 선택/Suite/replay), control(stdin), output/output-child(Windows 출력 격리와 유한 IPC ACK)로 분리한다. 공개 진입은 aqa bin이며 내부 모듈 import를 소비 계약으로 요구하지 않는다. alpha.8에서도 packages/cli/aqa.mjs 경로와 모든 명령/출력 의미를 유지한다.

## alpha.7 서비스 소비 경계

명령별 허용되지 않은 flag, 추가 positional, headed/headless 충돌은 INVALID_ARGUMENT/exit2다. --version/--help는 실행 adapter를 로드하지 않는다. run/run-suite의 stdout/stderr는 반드시 동시에 읽는다. Windows 동기 pipe를 채널별 작은 writer child로 격리하고 IPC 메시지 최대8MiB, 미확인 전달1건, ACK2초로 제한한다. 정체/EPIPE는 같은 채널의 재전송을 중단하고 exit3으로 끝낸다. stderr를 명시하면 stdout 실패 진단을 별도로 받을 수 있다.

CLI exit3은 전달 실패일 수 있으므로 result.json의 실제 outcome과 구분한다. 예를 들어 취소 결과가 cancelled여도 stdout이 닫혔으면 exit3이다. API 내부 run deadline이 observer 대기에서 끝나면 TIMEOUT/run → failed이고, 별도 출력 ACK 실패는 ENGINE_ERROR다. persisted terminal 결과는 수정하지 않는다.

서비스/Flutter는 stdout/stderr drain → stdin cancel → terminal/result 확인 → 유한 종료 대기 순서로 사용한다. 외부 hard kill/전원 종료는 writer·browser·remote Appium 자손 정리를 보장하지 않는다. 자기 소유 PID/session을 확인하는 외부 watchdog과 unknown 자원 격리가 필요하다. 동기 무한 사용자 callback/custom adapter 또는 멈춘 driver handle은 같은 프로세스에서 강제 정리할 수 없다. run 최대300초, 실패 evidence3초, cleanup5초, terminal callback1초는 각각 다른 예산이다.

