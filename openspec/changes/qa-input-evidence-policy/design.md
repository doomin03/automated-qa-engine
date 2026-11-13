# Design

## Decisions

readDocument/loadBlueprint에 optional documentRoot를 제공하고 CLI import/export/validate/plan/run/run-suite의 --document-root로 전달한다. 지정하면 최초 문서·TC flowRef·Suite cases·selector·target manifest 모두 realpath containment를 검사한다. 기본 미지정이면 기존 CWD/문서 상대 참조를 유지한다. asset referenceRoot 및 명시 Appium/secret 설정 경로는 별도 범위다. read는 regular file에서 max+1 byte만 읽고 1 MiB를 초과하면 거부한다.

screenshot params는 optional required:boolean(default false)이다. 수집 성공은 passed+PNG, 보호 정책으로 수집하지 못했거나 optional 수집오류는 step skipped와 sanitized 진단이다. required:true일 때 정책 skip은 blocked, 수집오류는 infra_error다. optional step이 skipped여도 나머지 테스트가 통과하면 전체 run은 passed일 수 있으며 step 상태로 구분한다. 일반 실패 후 부가 evidence 오류는 최초 실패를 보존한다. screenshot bytes도 bounded read/PNG 검증을 적용한다. 취소/지연 observer/cleanup 정책을 우회하지 않는다.

## Validation

각 evidence 시도는 증가하는 독립 번호와 비공개 staging 경로를 예약한다. adapter에는 signal/timeoutMs를 전달하고 완료 뒤 취소·마감 상태를 재검사한다. 검증한 PNG bytes를 별도 확정 경로에 exclusive write한 뒤에만 artifact를 등록한다. 취소를 무시한 custom adapter의 늦은 staging 쓰기를 강제 중단할 수는 없으나 확정 PNG 덮어쓰기와 result 배열의 늦은 변경은 차단한다. terminal result는 내부 작업 배열과 분리한 불변 snapshot이다.

기존 기본 상대 참조와 정상 screenshot 회귀를 유지한다. 명시 root 탈출·symlink·과대 문서, secret skip/수집실패/required 조합과 terminal report를 검사한다. 옵션은 공개 API/types/CLI 문서와 외부 설치 인수에 포함한다.
