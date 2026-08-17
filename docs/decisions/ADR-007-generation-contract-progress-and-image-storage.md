# ADR-007: 생성 계약, 진행 상태와 이미지 저장

## Status
Accepted

## Date
2026-08-17

## Context

초기 PoC의 공개 계약은 `generateImage(prompt)`였고 Kotlin과 C++에서 모델, LCM-LoRA,
4 steps와 캐시 출력 경로를 고정했습니다. 모델 관리 화면에서 가져온 파일과 생성 화면의
모델·LoRA·가중치·steps 상태가 실제 추론에 연결되지 않았으며, 결과도 덮어쓰는 캐시
파일 하나뿐이었습니다.

온디바이스 생성은 오래 걸리므로 사용자가 모델 로딩, 프롬프트 인코딩, sampling과 VAE
디코딩 중 어디에 있는지 알아야 합니다. `stable-diffusion.cpp`의 progress callback은 모델
tensor 로딩과 sampling이 함께 사용하므로, callback 숫자만 보고 단계를 판단하면 모델 로딩
진행값을 추론 steps로 잘못 표시하게 됩니다.

## Decision

1. TypeScript 공개 API는 prompt, 모델 URI, LoRA URI·가중치 배열, steps와 출력 URI를 하나의
   옵션 객체로 받습니다. Kotlin은 URI가 앱의 `filesDir` 내부인지, 입력 파일이 존재하는지,
   steps와 LoRA 가중치 범위가 유효한지 검사한 뒤 JNI에 전달합니다.
2. 모델은 하나, LoRA는 순서가 있는 0개 이상의 목록으로 전달합니다. 생성 화면은 자동 분류를
   기본 필터로 사용하지만 모델·LoRA 선택기 모두 `전체 보기`에서 모든 가져온 파일을 허용합니다.
   모델과 LoRA의 아키텍처 호환성은 현재 자동 판별하지 않습니다.
3. 진행 이벤트는 Expo Modules의 `onProgress` 하나로 전달하며 단계는 `loading`, `encoding`,
   `sampling`, `decoding`으로 제한합니다.
4. C++ 브리지는 `new_sd_ctx()` 전후를 loading과 encoding 경계로 사용하고,
   `get_learned_condition completed` 로그 이후만 sampling으로 취급하며, latent decode 시작 로그를
   decoding 경계로 사용합니다. 서브모듈 코드는 수정하지 않습니다.
5. loading은 코어가 제공하는 tensor 진행값에 전체 개수가 있을 때만 실제 백분율을 표시하고,
   sampling은 `N/M`을 표시합니다. 총 작업량을 알 수 없는 encoding과 decoding에는 가짜
   백분율을 만들지 않고 단계만 표시합니다.
6. 생성 PNG는 `Paths.document/images/YYYYMMDD-HHMMSS-<id>.png`에 직접 저장합니다.
   생성 성공 후 prompt, 모델, LoRA·가중치, steps와 생성 시각을 `images/meta.json`에 기록합니다.
7. PNG가 주 데이터입니다. `meta.json` 기록 실패는 경고만 남기고 성공한 PNG를 삭제하지 않습니다.
   반대로 네이티브 생성이 실패해 불완전한 출력 파일이 생기면 해당 파일을 삭제합니다.
8. 이번 단계는 PoC 연결 고도화에 한정합니다. 해상도 512×512, LCM sampler/scheduler와 CFG 1.0,
   생성마다 context를 생성·해제하는 수명 정책은 유지합니다.

## Alternatives Considered

### 모든 단계를 하나의 0–100%로 표시

- 단순하지만 encoding과 VAE decoding의 총 작업량을 코어가 제공하지 않습니다.
- 임의 가중치나 시간 추정치는 실제 진행률이 아니므로 채택하지 않습니다.

### progress callback 숫자를 항상 sampling steps로 사용

- UI 구현은 작지만 같은 callback이 모델 tensor 로딩에도 사용되어 `알 수 없는 값/4`처럼 잘못된
  상태를 표시합니다.
- 브리지에서 로그 경계와 현재 단계를 함께 추적하는 방식을 사용합니다.

### 결과를 캐시에 저장하고 나중에 복사

- 기존 PoC와 비슷하지만 앱 종료나 OS 캐시 회수 전에 복사해야 하는 추가 실패 지점이 생깁니다.
- 처음부터 앱 문서 저장소의 최종 경로에 기록합니다.

### 메타데이터 실패 시 PNG도 삭제

- 인덱스 일관성은 강해지지만 사용자가 기다려 얻은 이미지를 보조 데이터 실패 때문에 잃습니다.
- 이미지 보존을 우선하므로 채택하지 않습니다.

## Consequences

- 생성 화면의 선택 상태가 TS → Kotlin → JNI → C++ 전체 계약을 통해 실제 추론에 반영됩니다.
- 진행 UI는 `Loading → Encoding → Steps → Decoding` 순서를 항상 보여주며 측정 가능한 단계만
  수치를 표시합니다.
- 생성 결과는 앱 재시작과 캐시 정리 후에도 유지되고, 향후 history 화면은 `images/meta.json`을
  읽어 구현할 수 있습니다.
- `meta.json`은 PNG와 원자적 트랜잭션이 아니므로 메타데이터 없는 고아 PNG가 생길 수 있습니다.
  현재는 이미지 보존 정책상 허용하며 복구·재색인은 실제 필요가 생길 때 추가합니다.
- 진행 단계 경계 일부는 업스트림 로그 문자열에 의존합니다. 서브모듈 업데이트 후 로그가 바뀌면
  loading/sampling/decoding 전환과 실제 기기 표시를 함께 재검증해야 합니다.
- context 재사용, 취소, 호환성 검사, sampler·CFG·해상도 선택과 history UI는 후속 범위입니다.
