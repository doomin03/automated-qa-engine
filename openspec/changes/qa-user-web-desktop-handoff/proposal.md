# Proposal

## Why

사용자용 웹은 공용 테스트 시나리오 XML 배포와 진행 확인을 담당하고 Flutter Desktop은 실제 실행과 개별 테스트 개발을 담당한다. 기존 CLI는 XML template만 출력하여 사용자가 만든 임의 Blueprint를 배포할 수 있는 export 경계가 필요하다.

## What Changes

- 기존 qa.blueprint/v1의 XML 투영을 유지하고 검증된 임의 입력을 XML로 내보내는 export CLI를 추가한다.
- XML의 알 수 없는 태그/속성, 중복 구조, DTD/entity와 비정상 payload를 실행 전에 거부한다.
- 웹이 소비할 Engine 소유 XML 규칙·공개 fixture와 hash를 제공한다.
- Engine를 0.1.0-alpha.2 local-preview로 증분하고 schema 계약 0.1.0-draft.1을 유지한다. 기존 alpha.1 artifact는 보존한다.
- 다른 프로젝트가 패키지 이름으로 사용하는 공개 라이브러리 API와 Playwright adapter 진입점을 제공하고 독립 설치된 tgz에서 실제 브라우저 실행·취소·이벤트를 검증한다.
- Flutter/웹 제품 코드는 Checker가 담당하며 Engine에 UI·서버·AI 공급자를 추가하지 않는다.

## Capabilities

### New Capabilities

- qa-xml-distribution: 임의 Blueprint의 검증된 XML 배포와 Desktop CLI 가져오기/실행 경계.
- qa-reusable-package: 앱/서버 없이 설치 가능한 Engine의 공개 core/adapter API, CLI 및 버전·배포 계약.

### Modified Capabilities

없음. 기준 specs는 아직 없고 기존 qa-ai-blueprint change의 입력 의미를 유지한다.

## Impact

- integrationId: qa-user-web-desktop-handoff
- contractVersion: 0.1.0-draft.1
- dependsOn: qa-ai-blueprint / qa-flow-schema-core / qa-playwright-runner
- counterpartRepoChange: automated-qa-checker/openspec/changes/qa-user-web-desktop-handoff
- acceptanceCriteria: 지원되는 사용자 Blueprint의 XML 왕복 의미/악성 입력 거부, sibling repo 없는 외부 프로젝트의 tgz 이름 기반 import/CLI 실제 PASS/FAIL, 공개 API 취소·ordered events·versioned result, 정확한 bundle/tgz hash를 검증한다.
- 영향: CLI, 공개 package exports, core/adapter 경계, XML parser/serializer, 공개 contract release, 테스트와 역할/사용 문서. 새 runtime dependency 없음. 타입 소비 검증용 TypeScript 6.0.3만 devDependency로 고정한다.
