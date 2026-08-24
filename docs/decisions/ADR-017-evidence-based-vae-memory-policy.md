# ADR-017: 검증 근거 기반 VAE 메모리 정책

## Status

Accepted

## Date

2026-08-24

## Context

모바일 Vulkan 환경에서 모델과 해상도에 따라 VAE decode의 메모리 요구량이 크게 달라진다. Galaxy S26에서 SDXL Turbo Q4 모델을 768×768로 실행하면 non-tiled VAE decode 중 앱이 종료됐지만, VAE tiling을 사용하면 연속 생성에 성공했다.

동일 조건의 실기기 실험 결과는 다음과 같다.

- 32×32, overlap 0.50: 성공, decode 303.82초
- 48×48, overlap 0.50: 반복 성공, decode 약 253.94~258.60초
- 64×64, overlap 0.50: 3회 연속 성공, decode 199.43~244.86초

동일 seed로 32×32와 48×48 결과를 비교했을 때 이미지는 거의 동일했다. 실험 중 관찰된 기괴한 피사체 구성은 tiling에 따른 품질 열화로 판단하지 않는다. 64×64도 성공했지만 48×48 대비 속도 이득이 일관되지 않았고 더 큰 타일은 메모리 여유가 작다.

이 근거는 Galaxy S26의 **SDXL Turbo Q4 + 768×768 + 내장 VAE** 조합에만 해당한다. 다른 SDXL 모델, 양자화 타입, 해상도 또는 기기로 일반화할 근거는 아직 없다.

사용자가 지정한 생성 옵션을 시스템이 변경하면 안 된다. VAE tiling은 화면에 노출되는 생성 설정이 아니라 하드웨어 실행 정책으로 자동 결정하며, 실패 후 설정을 바꿔 재시도하는 fallback은 도입하지 않는다.

## Decision

- `sdxl-turbo-q4-768-safe-v1` VAE 메모리 정책을 도입한다.
- 모델 선택 시 저장된 파일의 header를 다시 검사한다. 다음 조건을 모두 만족할 때만 `sdxl-turbo-q4` profile로 분류한다.
  - tensor 구조가 SDXL UNet과 두 번째 text encoder를 포함한다.
  - 실제 GGUF tensor 저장 타입이 Q4_0, Q4_1 또는 Q4_K다.
  - GGUF `general.name`, 가져온 원본 파일명 또는 alias에 독립된 `turbo` 표기가 있다.
- native bridge는 profile이 `sdxl-turbo-q4`이고 요청이 정확히 768×768이며 TAESD와 Hires를 사용하지 않을 때만 VAE tiling을 활성화한다.
- 활성화 값은 tile 48×48, target overlap 0.50으로 고정한다.
- 그 외 모든 조합은 upstream 기본값인 VAE tiling 비활성을 유지한다. 추론 실패 시 자동 fallback하지 않는다.
- UI에는 profile이나 정책을 표시하지 않고 사용자 설정 및 이미지 metadata에도 기록하지 않는다. 이는 생성 의미가 아닌 내부 실행 정책이기 때문이다.
- Kotlin은 profile 계약을 검증하고 전달만 한다. 적용 조건과 tiling 설정은 `StableDiffusionBridge.cpp`가 소유한다.
- 요청 로그 한 줄에 판정과 실제 적용 결과를 함께 남긴다.
  - 활성: `vae_profile=sdxl-turbo-q4 vae_policy=sdxl-turbo-q4-768-safe-v1 vae_tiling=48x48@0.50`
  - 비활성: `vae_policy=default vae_tiling=disabled`

## Alternatives Considered

### 모든 SDXL 또는 모든 768×768 요청에 tiling 적용

구현은 단순하지만 실기기 검증 범위를 넘어선다. 일반 SDXL, 비양자화 모델 및 다른 Q 타입에서 불필요한 성능 저하나 예상하지 못한 동작을 만들 수 있어 채택하지 않는다.

### 64×64를 기본값으로 사용

세 번 연속 성공했고 일부 실행에서 빨랐지만, 48×48도 반복적으로 성공했으며 더 보수적인 메모리 여유를 제공한다. 현재 목표는 최고 속도보다 앱 종료 방지이므로 채택하지 않는다.

### 파일명만으로 모델 판정

빠르지만 사용자가 파일명과 alias를 자유롭게 바꿀 수 있고 실제 모델 구조나 tensor 저장 타입을 보장하지 못한다. header 기반 구조·타입 검사와 Turbo 식별자를 함께 사용한다.

### OOM 발생 후 작은 타일로 자동 재시도

실패 경로가 프로세스 종료일 수 있어 안정적인 복구를 보장할 수 없고, 현 단계의 요구사항인 fallback 금지에도 어긋나므로 도입하지 않는다.

## Consequences

- 검증된 SDXL Turbo Q4 768×768 조합은 사용자의 생성 설정을 바꾸지 않고 48×48 VAE tiling을 자동 사용한다.
- SD 1.5와 SDXL Turbo Q4 512×512는 기존 non-tiled 경로를 유지한다.
- 이름에 Turbo 표기가 없거나 tensor 구조·Q4 타입을 확인할 수 없는 모델은 안전하게 `default`로 분류된다. 이는 false positive를 줄이는 대신 일부 실제 Turbo 모델을 자동 적용하지 못할 수 있는 보수적 선택이다.
- 향후 다른 모델·기기 정책은 별도 실기기 근거와 새 profile/policy version으로 추가해야 한다. 기존 정책의 범위를 조용히 넓히지 않는다.
- 활성 여부는 `[settings]` 로그로 확인할 수 있으며, 연속 실행에서 성능이 느려진 경우 policy 오작동과 열 스로틀링을 구분하는 기준이 된다.
