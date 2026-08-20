# ADR-011: 생성 요청 로그 간소화

## Status
Accepted

## Date
2026-08-20

## Context

ADR-009의 상세 계측은 VAE decode 병목을 찾기 위해 단계별 wall/CPU time, CPU 비율, RSS,
sampling step과 upstream 정보 로그를 상시 출력했습니다. 병목 확인이 끝난 뒤에도 이를
유지하면 한 번의 생성에서 로그가 과도하게 쌓여 Vulkan 초기화, 실제 설정과 주요 단계
시간을 찾기 어려워집니다.

## Decision

- 정상 생성은 `StableDiffusionBridge` 태그로 약 10개의 정보 로그만 남깁니다.
- `[request]`는 모델·TAESD·LoRA 수와 최종 성공 여부·전체 시간을 기록합니다.
- `[settings]`는 prompt 길이, 해상도, preset과 실제 scheduler, steps, CFG, seed,
  Hires 방식·배율·steps·denoising strength와 출력 경로를 기록합니다. prompt 본문은
  logcat에 노출하지 않습니다.
- `[vulkan]`은 `sd_list_devices` 결과를 한 줄로 정규화해 실제 backend 장치를 확인합니다.
- `[stage]`는 loading, encoding, sampling, decoding, PNG write의 wall time만 초 단위로
  기록합니다.
- upstream 콜백의 info/debug 로그는 출력하지 않고 warning/error만 전달합니다. 콜백의
  info 문자열은 단계 경계 판별과 UI progress event에는 계속 사용합니다.
- CPU time, CPU/Wall, RSS, context free, sampling step별 계측은 일반 빌드에서 제거합니다.

## Alternatives Considered

### 기존 상세 계측 유지

성능 분석에는 유리하지만 일상적인 기능 검증에서 핵심 로그를 가립니다. 다음 병목 분석이
필요할 때 ADR-009의 방식을 임시 계측 빌드로 복원하는 편이 낫습니다.

### upstream 로그 전체 차단

출력량은 가장 적지만 경고와 오류까지 잃습니다. 문제 진단에 필요한 warning/error는
보존합니다.

## Consequences

- 성공 요청은 보통 요청 1줄, 설정 2줄, Vulkan 1줄, 단계 5줄, 완료 1줄로 확인합니다.
- warning/error가 발생하면 10줄을 넘을 수 있으며 이는 의도된 예외입니다.
- UI의 loading/encoding/sampling/decoding 진행 이벤트와 sampling step 갱신은 유지됩니다.
- 로그만으로 CPU 사용량이나 GPU 사용률을 추정할 수 없습니다. 정밀 성능 분석에는 별도
  계측 또는 Perfetto/Android GPU Inspector를 사용해야 합니다.
