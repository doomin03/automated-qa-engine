# Tasks

명세 초안 단계. alpha.10 Checker 통합 인수와 별도 관리 apply 승인 전 제품 payload를 수정하지 않는다. 신규 작업은 모두 미완료다.

## 1. 계약과 순수 후보

- [ ] 1.1 locator 입력/출력 schema·공개 타입·버전 규칙과 safe input을 구현하고 정상/미지 필드/한도/getter/toJSON/secret 원문 비반사 회귀를 통과한다.
- [ ] 1.2 data-testid/id 후보 생성과 CSS escaping을 구현하고 유니코드·특수문자·길이·빈값·결정 순서 및 기존 web selector 문법 검증을 통과한다.

## 2. 명시 웹 검사

- [ ] 2.1 web-tools 조립과 lazy 진입점/의존 gate를 구현하고 실제 Chromium unique/duplicate/detach/속성없음 및 main light DOM 제한을 검증한다.
- [ ] 2.2 origin/production·단일 deadline/cancel·startup join/cleanup을 적용하고 forbidden redirect·느린페이지·취소·cleanup 실패의 실제/fixture 회귀와 수집 금지 데이터를 확인한다.

## 3. CLI와 독립 소비

- [ ] 3.1 inspect-locators CLI의 strict flags/bounded 파일/--out exclusive/diagnostic transport를 구현하고 원본 보존·path escape·오류 exit·inspection과QA run 분리를 검증한다. 공개 사용법에 navigation 부작용·속성 민감정보·현재 시점 한계를 명시한다.
- [ ] 3.2 전체 verify와 새 runtime tgz 독립 API/bin/type/실제 Chromium 인수를 통과하고 alpha.10/기존 schema SHA를 보존한다. 새 locator bundle·파일 manifest·정확한 version/hash를 관리 인계한다.

## Workflow follow-up

- 후보 수집을 recorder 완료로 보고하지 않는다. 클릭 picker/행동 recording/Flow 변환과 whitebox sandbox는 별도 명세다.
- Checker UI 소비는 검증된 계약과 artifact 관리 승인 이후 별도 진행한다.
