# 기존 Dart 합성 기준

`compose-inputs.json`은 관리 작업 공간의 `compose-fixtures.json` 원본 bytes, `compose-dart-baseline.json`은 실제 Dart 3.13.4가 기존 Checker XmlBlockCompiler를 직접 실행한 결과 bytes다. 상세 source SHA/HEAD 및 기존 Engine roundtrip 증거는 `compose-provenance.json`에 보존한다. 제품 Engine은 Checker 또는 Dart 런타임에 의존하지 않는다.

관리 기준 경로: `C:/workspace/QA/coordination/multi-terminal-implementation-20261112`. 입력 raw SHA는 `7303f33e9cec0c609612a539b7cb33a349431165f1b35bbdb7415f3e51386c22`, 출력 raw SHA는 `ad48a9ca0b9bca28d1d6e9a2d850f42d99f3608517281dfdb2d9b69d4e8420a4`다.

4개 성공 사례는 public example 두 번, capture+branch 두 번, 혼합 세 번, secret reference 두 번이다. 3개 거부는 단절/cycle/target 불일치다. capture와 secret 선언 동시 사용은 기존 정책상 불가하여 성공 사례로 섞지 않았다. 새 sourceMap에서 sourceFile만 UI 보강 대상으로 제외하고 모든 namespace/참조/label/원본 ID/hash를 비교한다.
