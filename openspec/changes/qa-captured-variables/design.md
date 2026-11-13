# Design

## Context

alpha.4는 고정 literal/secret variable과 literal branch를 지원한다. alpha.5에서 기존 고정 artifact를 보존하고 사용자 지정 XML의 공개 DOM 값을 활용한다.

## Decisions

variable은 `{from:"capture",public:true}`로 선언하고 captureText/captureValue params는 `{selector,variable}`이다. 캡처는 웹만 지원하며 adapter의 optional capture(node,context):Promise<string> port를 사용한다. compile은 선택한 플랫폼 capability와 변수 참조를 검증한다. literal/secret은 초기화 상태로 시작하고 각 node 입력 집합은 모든 predecessor 출력 집합의 교집합이다. valueRef/expectedRef/branch는 그 시점에 definite assignment된 변수만 읽는다. secret branch는 계속 금지한다. capture가 성공한 뒤에만 변수 집합에 기록한다. 재시도 전 기존 값은 지우며 실패하면 후속 노드를 실행하지 않는다.

public:true는 사용자가 값을 비민감하다고 선언한다는 뜻이며 PII를 자동 판별하는 보증이 아니다. secretRef가 선언된 Flow와 capture 혼용은 compile 단계에서 거부한다. password input, autocomplete=current-password/new-password/one-time-code, data-qa-sensitive 표시 요소 및 해당 조상/후손을 포함한 선택은 blocked다. DOM 구조로 식별되지 않는 비밀·PII는 사용자의 공개 선언 책임이며 private session을 자동 발견한다고 주장하지 않는다.

captureValue는 input/textarea/select의 value를, captureText는 보이는 DOM text node를 DOM 순서로 결합한다(가상 rendered innerText/whitespace 정규화 아님). iframe/canvas/shadow root는 미지원이다. DOM 내부에서 길이 16,384자와 최대 방문 10,000 nodes를 먼저 검사하고 한도를 넘으면 값 자체를 Node process로 전송하지 않는다. style/script 및 숨은 descendant는 text에서 제외한다. getter/앱 스크립트를 실행하는 사용자 표현식은 받지 않는다.

값은 runtime map에만 보존한다. source/plan/event/result/check-report/failure message에 기록하지 않고 secretResolver에 넘기지 않는다. 공개 값이 DOM에 표시된 일반 screenshot에는 보일 수 있으며 public:true 선언이 이 제한의 근거다. screenshot을 비밀 저장소로 간주하지 않는다. 기존 취소/timeout/cleanup 경계를 그대로 적용한다.

## Validation

join 한쪽만 capture된 읽기, 초기화 전 input/assert/branch, 순환·잘못된 selector, 비밀 혼용을 compile에서 거부한다. 실제 Chromium에서 captureValue/Text→input/assertValue.expectedRef→branch 및 반복 재할당을 인수한다. capture 실패 시 이전값 사용 없음, 긴 문자열/민감 DOM/원문 오류 비노출, 독립 tgz CLI/XML 실행을 검증한다.
