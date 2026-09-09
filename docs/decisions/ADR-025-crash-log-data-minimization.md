# ADR-025: 크래시 로그 데이터 최소화

## Status

Accepted

## Date

2026-09-09

## Context

ADR-022는 강제 종료 뒤에도 분석 가능한 breadcrumb, native log tail, tombstone stack을 정의했다. 그러나 일반 logcat에는 모델·출력·양자화 경로, prompt 길이, seed와 모델 variant가 남았고 breadcrumb에도 variant가 포함됐다. 또한 native log 정제는 `/data/data/.../files/...` 경로만 처리해 다른 Android 경로와 URI를 놓칠 수 있었다.

크래시 분석에는 마지막 성공 지점과 정상 로그의 실행 순서가 중요하다. 따라서 `nativeTail`을 warning/error로 제한하면 SIGSEGV 직전의 핵심 맥락을 잃는다. 수집량은 줄이되 원인 분석 능력은 유지해야 한다.

목표는 모델 정보를 완전히 익명화하는 것이 아니다. 모델명·파일명·alias 같은 직접
식별자는 제거하되 family, tensor 구성, 양자화/storage와 크기는 모델 조건별 크래시율과
메모리 문제를 묶는 데 필요한 진단 신호다. 이 특성만으로 Pony 같은 계열을 추정할 수
있더라도 직접 식별자가 없다면 허용한다.

## Decision

- breadcrumb, `last-crash.json`, 일반 logcat에서 prompt, negative prompt, seed, 모델·LoRA·출력·양자화 경로, 파일명, alias와 명시적 모델 variant 식별 정보를 기록하지 않는다.
- 최소화된 breadcrumb와 `generation_crash` 문서는 `schemaVersion: 3`을 사용한다. 기존 v2 보고서를 새 계약으로 오인하지 않는다.
- 모델 정보 중 구조적 family는 유지한다. 메모리 문제와 모델별 크래시 지표에 필요한
  tensor/component 구성, 양자화·storage type과 추정 byte도 유지한다.
- 해상도, steps, preset, CFG, LoRA 개수, TAESD/Hires 사용 여부, resolved memory policy, backend, VAE tiling과 Vulkan 정보는 실행 workload와 backend 분석 자료로 유지한다.
- `nativeTail`은 로그 레벨과 관계없이 최대 40줄을 유지한다. 정상 로그를 포함해야 크래시 직전 실행 순서와 마지막 성공 지점을 알 수 있기 때문이다.
- upstream 로그는 여러 줄을 개별 행으로 처리한다. prompt·negative prompt·모델 경로 설정 행은 버리고, `file://`, `content://`, `/data/data/`, `/data/user/`, `/storage/emulated/` 경로는 `<app-file>`로 치환한다.
- upstream warning/error를 logcat으로 전달할 때도 `nativeTail`과 동일한 정제 함수를 사용한다.
- 메모리 정책 판정에는 variant evidence를 계속 사용할 수 있지만 로그와 크래시 보고서에는 노출하지 않는다.

## Alternatives Considered

### warning/error만 `nativeTail`에 보존

수집량은 가장 작지만 native signal crash는 오류 로그를 남기지 못할 수 있고, 직전 정상 단계의 순서를 잃는다. 실제 원인 분석에 필요했던 정보가 제거되므로 채택하지 않는다.

### `nativeTail` 완전 제거

tombstone symbol이 없거나 stack이 불완전한 기기에서 보조 근거가 사라진다. 채택하지 않는다.

### 경로만 정제하고 기존 구조화 필드를 모두 유지

명시적 variant, seed와 prompt 길이는 기술 특성만으로 수행하는 크래시 분류에 필수적이지
않으며 향후 외부 전송 시 불필요한 식별·사용자 입력 정보를 늘린다. 데이터 최소화 목적에
맞지 않아 채택하지 않는다.

## Consequences

- 크래시 보고서와 logcat에서 모델 파일 및 사용자 입력을 식별하기 어려워진다.
- 명시적 모델 variant별 문제를 직접 분류할 수는 없다. 대신 family, tensor/component
  구성, storage/양자화와 byte 추정으로 기술적으로 유사한 모델 조건을 묶어 분석한다.
- `nativeTail`의 정상 로그와 실행 순서는 유지되지만 민감 설정 행과 경로는 제거된다.
- 새로운 upstream 로그 형식이 추가되면 정제 규칙과 contract test를 함께 갱신해야 한다.

## Validation

Galaxy S20+(`SM-G986N`, Android 13, Adreno 650)에서 의도적으로 발생시킨 SIGSEGV의 v3
보고서를 확인했다.

- prompt, seed, 모델명·파일명·alias, 명시적 variant와 원본 경로는 없고 경로는
  `<app-file>`로 치환됐다.
- `family=sd1`, `diffusionStorage=q4`, `diffusionBytes=2639800656`, component별 weight type과
  VRAM 크기는 남아 모델 구조·양자화·크기 조건을 식별할 수 있었다.
- `stage=text_encoding_params`, `textEncoderParams=vulkan`, `SEGV_MAPERR`,
  `faultAddress=0x0`와 `ggml_backend_buft_alloc_buffer` 스택이 남아 Vulkan parameter buffer
  할당 중 null 접근 후보로 범위를 좁힐 수 있었다.
- info 레벨 `nativeTail`이 model load, lazy weight preparation, text encoding 진입 순서를
  보존해 warning/error만으로는 얻을 수 없는 마지막 성공 지점을 제공했다.

이 결과는 직접 식별자 없이도 모델 조건별 집계와 단일 크래시 원인 분석에 필요한 정보가
유지됨을 보여 준다.

## References

- [ADR-011](ADR-011-generation-request-logging.md)
- [ADR-018](ADR-018-model-descriptor-memory-policy-resolution.md)
- [ADR-021](ADR-021-crash-surviving-generation-diagnostics.md)
- [ADR-022](ADR-022-generation-crash-report-schema.md)
