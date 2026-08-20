# ADR-010: 생성 옵션과 내장 Hires 업스케일 노출

## Status
Accepted

## Date
2026-08-20

## Context

ADR-007은 첫 PoC 연결을 위해 512×512, LCM, CFG 1.0을 C++ 브리지에 고정했습니다. 이후 디코더 선택이 연결되었고, 다음 PoC는 `stable-diffusion.cpp`의 생성 기능을 앱에서 직접 비교할 수 있어야 합니다.

## Decision

- 생성 계약에 negative prompt, 기본 width/height, sampling preset, CFG, seed를 추가합니다.
- sampling preset은 sampler와 scheduler의 검증된 한 쌍을 문자열 하나로 전달하고 `StableDiffusionBridge.cpp`에서 upstream enum으로 변환합니다.
- upstream이 구현한 sampler를 모두 preset으로 노출하며 DPM++ Karras 조합도 별도 preset으로 제공합니다.
- 업스케일은 별도 모델 없이 `sd_img_gen_params_t.hires`의 내장 latent, Lanczos, nearest 방식을 사용합니다.
- 업스케일 배율은 1.5×부터 4.0×까지 0.5 단위이며, hires steps와 denoising strength도 전달합니다.
- 사용자가 랜덤 seed를 선택하면 앱이 실제 정수를 생성해 추론과 metadata에 동일하게 기록합니다.
- Kotlin은 숫자와 앱 저장소 경계를 검증하고, 문자열 preset의 최종 유효성 검사는 enum 매핑의 단일 출처인 C++ 브리지에서 수행합니다.

### 호출 경로와 계약

`src/app/index.tsx` → `stable-diffusion/src` → Expo Kotlin module → JNI →
`StableDiffusionBridge.cpp` → `sd_img_gen_params_t` 순서로 같은 값을 전달합니다. Expo
`AsyncFunction`의 인자 수 제한을 피하기 위해 새 생성 값은 TypeScript와 Kotlin 사이에서
`GenerationOptions` 객체 하나로 묶고, JNI 경계에서는 명시적인 네이티브 인자로 풉니다.

| 항목 | 앱 기본값 | 네이티브 허용 범위 |
|---|---:|---|
| 기본 해상도 | 512×512 | width/height 각각 64~2048 |
| sampling preset | `lcm` | C++ 매핑에 존재하는 23개 값 |
| steps | 4 | 1~100 |
| CFG | 1.0 | 0~30 |
| seed | 랜덤 | -1 이상; 앱은 생성 전에 실제 정수로 확정 |
| Hires | `none` | 8개 내장 방식 또는 비활성 |
| Hires scale | 2.0× | 1.5×~4.0×, 0.5 단위 |
| Hires steps | 4 | 0~100 |
| denoising strength | 0.7 | 0.0001~1.0 |

### Sampling preset

- 기본 scheduler는 `discrete`입니다.
- `lcm`, `tcd`는 `lcm` scheduler를 사용합니다.
- `ddim`은 upstream의 `ddim_trailing` sampler와 `simple` scheduler를 사용합니다.
- `dpmpp_2m_karras`, `dpmpp_2m_sde_karras`는 각각 대응 DPM++ sampler와 `karras`
  scheduler를 사용합니다.
- 나머지 preset은 같은 이름의 upstream sampler와 기본 `discrete` scheduler를 사용하며,
  앱 표기용 DPM++ 식별자는 브리지에서 upstream 문자열로 변환합니다.

노출 preset은 Euler 계열, Heun, DPM2/DPM++ 계열, IPNDM 계열, LCM, DDIM, TCD,
RES 계열, ER-SDE, LMS를 포함한 23개입니다. sampler와 scheduler를 독립 입력으로 받지
않으므로 검증 단위와 metadata가 항상 같은 조합을 가리킵니다.

### 내장 Hires와 metadata

내장 방식은 `latent`, `latent_nearest`, `latent_nearest_exact`, `latent_antialiased`,
`latent_bicubic`, `latent_bicubic_antialiased`, `lanczos`, `nearest`입니다. 별도 upscaler
모델 파일은 받지 않으며 upstream이 기본 크기와 scale로 목표 크기를 계산합니다.

새 PNG metadata에는 negative prompt, 기본 크기, preset, steps, CFG, 실제 seed와 Hires
설정을 저장합니다. 기존 결과는 새 필드가 없어도 읽을 수 있도록 저장 metadata에서는 해당
필드를 optional로 유지합니다.

## Alternatives Considered

### Sampler와 scheduler를 독립 선택

가능한 조합은 많지만 PoC UI와 네이티브 계약이 불필요하게 커집니다. 비교 단위를 명확히 하기 위해 하나의 preset으로 묶습니다.

### 외부 ESRGAN 모델 업스케일

별도 파일 형식 검증과 저장소 분류가 필요합니다. 이번 범위는 가중치 없이 사용할 수 있는 upstream 내장 hires 방식에 한정합니다.

## Consequences

- 생성 화면의 고급 옵션이 TS → Kotlin → JNI → C++ 전체 경로에서 실제 추론에 반영됩니다.
- 23개 sampling preset과 8개 내장 hires 방식의 조합을 실기기에서 비교할 수 있습니다.
- hires는 목표 해상도에서 추가 sampling과 decode를 수행하므로 높은 배율은 시간과 메모리를 크게 사용합니다.
- 기존 이미지 metadata는 새 필드가 없어도 읽고, 새 결과에는 전체 생성 설정을 기록합니다.
- 네이티브·TypeScript 빌드와 metadata 테스트는 통과했습니다. 23×8 전체 조합의 실기기
  성공 여부, 품질, peak memory는 아직 검증 결과로 간주하지 않습니다.
