# 디자인·UX 검사

alpha.4 / contract 0.2.0-draft.1의 공개 API와 XML 확장이다. 설치 artifact의 실제 인수/hash는 별도 release 기록을 확인한다. Figma API·GUI는 포함하지 않는다. 웹 비교와 Appium 앱 제어는 서로 다른 capability다.

## 실행과 입력

```powershell
aqa validate design.xml --reference-root C:\qa\references
aqa plan design.xml
aqa run design.xml --reference-root C:\qa\references --json --diagnostics stderr --report C:\qa\reports
```

Blueprint.references는 `qa.designReference/v1` 배열이다. XML 루트 `<references><![CDATA[JSON 배열]]></references>`와 기존 `<target>`의 profile로 보존한다. `blueprintXml()` API와 `aqa export FILE --format xml`을 사용할 수 있다. import/validate/plan은 브라우저를 실행하지 않으며 명시 reference-root가 있으면 asset까지 검사한다. run은 PNG/font를 실제 사용할 때 reference-root가 필요하다. 기준 이미지를 자동 덮어쓰지 않는다.

reference는 id/profile/images/measurementRules를 가진다. image는 `{id,path,sha256,region,threshold:{channelTolerance,maxDiffRatio}}`, rule은 `{id,selectorId,otherSelectorId?,metric,expected,tolerance,source:{document,sha256}}`이다. source hash는 사용자가 선언한 수치 출처 JSON 식별이며 임의 원격 fetch는 없다. 로컬 asset bytes와 전체 reference snapshot hash는 별도로 검증한다. [정본 schema](../contracts/schemas/qa.schema.json)와 소스의 tests/design.test.mjs에 정확한 필드가 있다.

## Profile과 폰트

target.profile은 viewport.width/height(CSS px), dpr, 정확한 browserVersion, os(win32/linux/darwin), locale, colorScheme, fonts, readiness(selector/timeoutMs)를 갖는다. 각 reference.profile과 동일해야 한다. 실제 browser/OS/viewport/DPR/locale를 대조한다. baseline을 만든 환경의 버전을 기록해야 한다. 총 viewport pixels는 16,777,216 이하이다.

fonts는 `{family,path,sha256}` 배열이다. 기본 모드는 앱이 요청한 웹폰트 응답 hash와 loaded FontFace family를 확인하며 측정 대상의 computed font-family도 대조한다. 명시 fonts가 있을 때만 응답을 읽고 content-length가 있는 최대 10 MiB, 16개/64 MiB로 제한한다. 확인할 수 없으면 blocked다. 시스템 font의 byte 동일성이나 모든 fallback glyph까지 보장하지 않는다. 빈 fonts는 별도 웹폰트 검증을 요구하지 않는다는 뜻이다.

`injectFonts:true`일 때만 검증한 asset을 FontFace로 주입한다. 이는 명시 테스트 환경 조성이며 앱의 원래 font 로딩 성공을 의미하지 않는다. report.fontsInjected로 구분한다. readiness selector와 document.fonts.ready는 run/step deadline 내 확인한다. 다른 OS의 rasterization 동등성을 주장하지 않는다.

## 검사와 제한

| action | params | 의미 |
| --- | --- | --- |
| assertImage | reference,image | PNG 기준 비교 |
| assertLayout | reference,rule | 명시 수치 비교 |
| assertInViewport | selector | bbox 전체가 viewport 안인지 |
| assertHitTarget | selector | 중심 및 안쪽 모서리 4곳 hit-test |
| assertFocused | selector | document.activeElement 일치 |
| assertUrl | expected | 실제 URL 정확 일치 |
| browserBack | 빈 객체 | 웹 history 이동 |

수치 metric은 bbox.x/y/width/height, gap.horizontal=B.left-A.right, gap.vertical=B.top-A.bottom, font-size다. gap에는 otherSelectorId가 필요하며 음수는 겹침이다. 단위 CSS px, 판정 `abs(actual-expected)<=tolerance`다. 관측은 click/fill/auto-scroll 없이 수행한다. 요소 없음은 failed, 중복은 blocked다.

PNG 한도는 파일 10 MiB, 16,777,216 pixels, 8-bit 이하 non-interlaced다. signature/IHDR/CRC/종료 구조를 검사한다. 총 asset 128개/64 MiB, 명시 root의 realpath 안 상대경로만 허용한다. symlink 탈출/hash 변조는 거부한다. decoder/비교는 worker에서 수행하고 timeout/취소 시 종료한다. sRGB/무색상 profile 및 표준 gamma만 비교하고 기타 color profile/APNG는 blocked다. 투명 RGB를 흰색에 합성한 뒤 최대 channel 차이가 channelTolerance를 넘는 pixel 비율이 maxDiffRatio 이하이면 통과한다. resize/OCR/AI 판정은 없다.

region은 viewport 또는 CSS x/y/width/height다. 각 경계에 DPR을 곱해 독립 반올림한 pixel 영역을 사용한다. 크기/profile 불일치는 blocked다. secretRef 실행 또는 password input이 있는 화면의 이미지 검사는 blocked다. 없는 이미지로 통과하지 않는다.

hit-test는 iframe/canvas/shadow root 내부를 지원하지 않는다. pointer-events:none 시각 overlay, 모든 형태의 부분 가림이나 이후 DOM 변화까지 보장하지 않는다. browserBack은 HTTP와 same-document history에 적용하고 후속 URL/화면 assertion으로 기대 동작을 검증한다. 이동 없음은 blocked, 허용 origin 밖은 정책 거부다. retry는 기존 allowSideEffects를 요구한다. OS 키보드/IME나 모바일 system back을 뜻하지 않는다.

## Versioned preset

```powershell
aqa preset list
aqa preset expand web-input --preset-version 1.0.0 --bindings bindings.json --out input.xml
aqa run input.xml --json
```

API는 listPresets()와 expandPreset(id,version,bindings)다. list는 정확한 version/hash/template/필수 binding을 반환한다. 전개는 무실행이며 target/selectors는 정본 객체다.

- web-input: id,target,selectors,launch(target alias),selector,value. value는 문자열 또는 `{secretRef:"login.password"}`. launch→viewport→hit→tap→focus→input→assertValue 순서다. 비밀값은 resolver에서만 얻고 XML에는 valueRef/expectedRef만 보존한다.
- web-history-back: id,target,selectors,from,to,expectedUrl,expectedSelector. 두 launch 후 back/URL/화면을 확인한다.

coverage는 매핑한 입력과 경로에 한정한다. 앱 전체 기본 검사 완료를 뜻하지 않는다.

## 결과와 lifecycle

차이·행동 불일치는 failed, 조건 불일치·미지원은 blocked, browser/수집 장애는 infra_error, 명시 취소는 cancelled다. preflight 거부에는 실행 결과를 꾸며 만들지 않는다. `qa.checkReport/v1`은 nodeId/kind/verdict/reason/referenceHash/profileHash/expected/actual/tolerance/artifactRefs를 저장한다. baseline/actual/diff PNG 역할은 report에서 연결하고 result/events에는 check-report(application/json) 또는 screenshot(image/png)의 상대 파일명/hash/size가 남는다. secret 실행의 URL actual은 redacted다.

관측은 run/step deadline과 signal을 공유하며 report schema를 검증한 뒤 저장한다. worker 종료, durable terminal, 실패 증거 최대 3초·cleanup 최대 5초·terminal observer 최대 1초는 [공개 lifecycle](package-api.md)을 따른다. 동기 무한 점유 custom callback/adapter의 OS 강제 격리는 없다. custom adapter 관측과 QaError.message는 신뢰 경계이므로 비밀을 직접 담지 않아야 한다.
