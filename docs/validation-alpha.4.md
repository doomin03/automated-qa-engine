# Engine alpha.4 인수 기록

후속 발견(2026-10-31): custom adapter의 screenshot 수집이 step timeout 뒤 늦게 완료하면 artifact 번호 충돌로 확정 PNG가 바뀌거나 반환 result 배열이 증가하는 경로가 재현됐다. 아래 alpha.4 고정 tgz/hash는 보존한다. alpha.5는 시도별 staging/확정 파일 분리, signal/deadline 재검사와 불변 result snapshot으로 수정하고 지연 수집 회귀를 추가한다. alpha.4의 기존 통과 기록은 이 경계까지 보장하지 않는다.

2026-10-31, automated-qa-engine main, HEAD ecdb8ff87b1b45b93a38921a44d36c8adb068cd8의 미커밋 작업 상태. commit/push/npm publish 없음. 정본 schema는 Engine이 소유한다.

## 고정 산출물

- runtime 0.1.0-alpha.4 / contract 0.2.0-draft.1, Blueprint/event/result schema v1 유지.
- tgz: artifacts/package/0.1.0-alpha.4/automated-qa-engine-0.1.0-alpha.4.tgz
- SHA-256: aad28a4fb23cfc6fa861e33cbedac88ab3aea6e254fc544812c9ec9471d9c6b4
- integrity: sha512-G7nIW619CGgd6ztlX6MUSW4x/dT8zX+XZjsZ6xjrf7caFm7rJg5Q4IKwWzSpUlgnUNiASyBjQFz3gggncZVsaw==
- bundle: contracts/releases/qa-contract-0.1.0-alpha.4.json
- bundle SHA-256: ec786a5bf661eff3237c2804b1e9cafb195bb04c1b23c346090cbf022eb80a87
- XML: contracts/releases/qa-blueprint-0.1.0-alpha.4.xml
- XML SHA-256: bc2210abfcdb7de02ae77e51598535da63e2dcd4c501670e5e160aa3fa3bd729
- XML snapshot: sha256:1e24d3c9a5217aa706a02a4ef7620192673f508bb19fbd2e661a13e9756589a1
- web-input 1.0.0 preset SHA-256: e03427450e06104a40b70c15c42b62bdbadb3cd331deb82d326c1f17f41a0589
- web-history-back 1.0.0 preset SHA-256: 8eb28fd73f604076634011bb085c9d0c4534a9e518512a065f22aa96efafe785

bundle.presets에 목록/필수 binding/template이 있다. 같은 artifact 디렉터리의 verification.json/pack-manifest.json이 설치·실행 및 포함 파일 증거다. alpha.5 authoring.mjs는 alpha.4 pack에서 제외했다. 앞선 후보 3b2173d9…는 최종 pin이 아니다.

## 독립 소비와 전체 검증

`npm run test:package`는 sibling repository가 없는 `C:\Users\Domin\AppData\Local\Temp\aqa-package-consumer-OnHFDN`에 tgz를 설치했다. package-name import/공개 API/types 및 설치 CLI로 20회 인수했다.

- 기존 API PASS/FAIL/cancel, CLI XML PASS/FAIL, 실패 후 observer rejection, Windows stdin cancel: 7회.
- image PASS/FAIL/blocked, layout PASS/FAIL, UX 정상/overlay/focus 실패, image CLI PASS 및 cancel: 실제 Chromium 10회.
- Appium API PASS/FAIL 및 native CLI PASS: **protocol fixture 3회**, 실기기 아님.

20 result/38 artifact/15 check-report의 identity·terminal·순서·size/hash를 검증했고 관리 에이전트가 독립 대조했다. TypeScript 6.0.3 strict valid 소비 통과 및 invalid 소비 거부, human help/--help --json/preset list/native 정적 diagnostics도 설치 CLI에서 확인했다.

최종 `npm run verify`: **116/116 PASS, fail/skip 0**, OpenSpec strict 9/9, foundation/bundle/type drift PASS. 이 총계에는 다음 alpha.5용 미공개 authoring 모듈 테스트 18개가 포함되며 alpha.4 배포 기능을 뜻하지 않는다. alpha.4 관련 테스트는 98개다. 추가 명세만 작성한 뒤의 OpenSpec 검증은 각 change 인계 기록을 따른다.

PNG/profile/DPR/수치/UX, secretRef 입력, XML 왕복, worker timeout/cancel, report lifecycle, SPA의 같은 URL·다른 URL popstate를 실제 Chromium으로 검증했다. Android/iOS는 adapter/protocol/CLI만 검증했으며 adb/appium/xcrun/listener가 없어 실제 기기 인수는 미완료다. native doctor/devices의 nativeConfigured는 설정 유효성이고 connectionVerified:false/targets:[]는 실제 discovery가 없다는 뜻이다.

alpha.2 tgz SHA-256 5478fae0b40b973a3f4529efc940575edb5f273821d7d5b8ca1b8a651cb0df28 및 alpha.3 ea8ec57eb40d362698f3fb47bc7a583848cd3cde3e1806483b2d0a2c6ba13285를 재확인했다. 이 기록은 npm files에 포함되지 않아 고정 tgz를 바꾸지 않는다. 후속 capture/반복 작성은 alpha.5에서 진행한다.
