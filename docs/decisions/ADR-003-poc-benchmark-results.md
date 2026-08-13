# ADR-003: SD 1.5 온디바이스 생성 PoC 결과

## Status
Accepted

## Date
2026-08-13

## Context
Pocket Canvas는 Galaxy S26의 Exynos SoC와 Xclipse 960 GPU에서 범용 Stable
Diffusion 모델을 완전히 오프라인으로 실행해야 합니다. 사용자가 가져온 safetensors와
LoRA를 지원하려면 특정 제조사의 NPU 전용 모델 대신 `stable-diffusion.cpp`의 mmap과
Vulkan 경로가 실제 기기에서 동작하는지 검증할 필요가 있었습니다.

PoC의 기능 기준은 다음과 같습니다.

- Stable Diffusion 1.5 모델을 앱 내부 저장소에서 mmap으로 로드
- Xclipse 960의 Vulkan backend에서 512×512 이미지 생성
- LoRA 적용 및 양자화 모델 실행
- 결과 PNG를 React Native UI에 렌더링

목표 생성 시간은 60초 이내로 설정했습니다.

## Benchmark

**기기:** Galaxy S26, Android 16, Samsung Xclipse 960

**프롬프트:** `A cat in a space suit`

| 항목 | SD 1.5 fp16 | SD 1.5 Q4_K + LCM-LoRA |
|---|---:|---:|
| 모델 | `v1-5-pruned-emaonly-fp16.safetensors` | `v1-5-pruned-emaonly-q4_k.gguf` |
| 해상도 | 512×512 | 512×512 |
| Sampling | Euler A, 20 steps, CFG 7.0 | LCM, 4 steps, CFG 1.0 |
| 파라미터 VRAM | 2,035.00MB | 1,600.29MB |
| Sampling 시간 | 1,560.51초 | 54.19초 |
| VAE decode 시간 | 67.58초 | 57.06초 |
| 전체 시간 | 1,632.62초 | 116.17초 |
| 결과 이미지 | 생성 성공 | 생성 성공 |

Q4_K + LCM-LoRA 구성은 fp16 기준선보다 전체 생성이 약 14.1배 빨랐고, sampling은
약 28.8배 빨랐습니다. 파라미터 VRAM은 약 435MB 감소했습니다. 로그에서
`Vulkan0 Samsung Xclipse 960`, LCM sampler, 그리고 LCM-LoRA 834개 tensor의 적용을
확인했습니다.

실험 원본은 `test-result/`의 로그와 결과 이미지로 보존합니다.

## Decision

온디바이스 생성의 기본 PoC 구성을 다음과 같이 채택합니다.

| 항목 | 값 |
|---|---|
| 기본 모델 | SD 1.5 Q4_K GGUF |
| 가속 어댑터 | SD 1.5 LCM-LoRA, weight 1.0 |
| 해상도 | 512×512 |
| Sampling method / scheduler | LCM / LCM |
| Sampling steps | 4 |
| CFG | 1.0 |
| 모델 로딩 | mmap |
| 연산 backend | Vulkan |

이 구성은 Exynos 기기에서 Vulkan, mmap, 양자화 모델, LoRA, PNG 출력, React Native
렌더링을 모두 입증했으므로 **기능 PoC는 성공**으로 판정합니다.

다만 전체 116.17초로 60초 성능 목표에는 미달했습니다. Sampling은 54.19초까지
감소했지만 VAE decode가 57.06초를 차지하므로, 이후 성능 개선은 sampling step 추가
감축보다 decode 경로를 우선해야 합니다.

## Alternatives Considered

### SD 1.5 fp16, 20 steps

- 표준 체크포인트를 변환 없이 사용할 수 있습니다.
- 전체 생성에 약 27분이 걸려 제품 경로로 사용할 수 없습니다.
- 성능 기준선으로만 유지하고 기본 실행 구성에서는 제외합니다.

### Exynos NPU 전용 실행

- 더 큰 성능 향상 가능성이 있습니다.
- 모델을 전용 그래프와 형식으로 변환해야 하며 범용 safetensors·LoRA 지원과 충돌합니다.
- 현재 PoC 범위에서는 채택하지 않습니다.

### 저해상도 생성 후 업스케일

- 60초 목표에 도달할 가능성이 높습니다.
- 512×512 latent 생성과 품질 특성이 달라 별도 실험으로 분리합니다.

## Consequences

- 가져온 safetensors는 앱의 설치·준비 단계에서 GGUF로 양자화하는 방향을 사용합니다.
- LCM 호환 SD 1.5 모델에는 LCM-LoRA와 저-step preset을 적용할 수 있습니다.
- 모델별 양자화 및 LoRA 호환성을 검사하는 설치 파이프라인이 필요합니다.
- 현재 최우선 성능 병목은 약 57초의 VAE decode입니다.
- 60초 목표를 위한 다음 실험 후보는 TAESD 또는 저해상도 생성 후 업스케일입니다.
- NPU 전용 경로는 범용 모델 호환성으로 목표를 달성할 수 없을 때 재검토합니다.
