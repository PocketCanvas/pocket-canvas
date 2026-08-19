# ADR-009: 이미지 생성 병목 계측과 TAESD PoC

## Status
Accepted

## Date
2026-08-19

## Context

ADR-003의 Q4_K + LCM-LoRA 구성은 sampling을 약 54초까지 줄였지만 전체 생성은
약 116초였고, VAE decode가 약 57초를 차지했습니다. 다음 최적화 대상을 정하려면
단순 전체 시간 외에 loading, encoding, sampling, decoding, PNG 저장과 context 해제의
시간 및 자원 사용을 분리해 관찰할 필요가 있었습니다.

Android 공개 API는 모든 기기에서 동일하게 신뢰할 수 있는 GPU 사용률을 제공하지 않습니다.
따라서 GPU 사용률을 임의로 계산하지 않고, 프로세스 wall time·CPU time·RSS와 upstream의
backend/VRAM 로그를 함께 사용해 CPU 연산과 GPU 실행·동기화 대기 후보를 구분합니다.

### Decoder의 역할

Stable Diffusion 1.x의 diffusion model은 완성된 RGB 픽셀이 아니라 압축된 latent를
생성합니다. VAE decoder는 이 latent를 512×512 RGB 이미지로 복원하는 학습된 신경망이며,
형태의 세부 표현, 질감, 경계, 색감과 선명도에 직접 영향을 줍니다. 따라서 decoder 교체는
무손실 후처리 최적화가 아니라 속도와 복원 품질 사이의 모델 교체입니다.

`stable-diffusion.cpp`에는 TAESD 실행 구조가 포함되어 있지만 학습된 가중치는 포함되지
않습니다. SD 1.x용 TAESD safetensors를 별도로 가져와 `sd_ctx_params_t.taesd_path`로
전달해야 합니다. `tae_preview_only`가 false이면 최종 decode에 기본 VAE 대신 TAESD를
사용합니다.

## Experiment

**기기:** Galaxy S26, Android 16, Exynos `s5e9965`, Samsung Xclipse 960

**공통 구성:** SD 1.x, 512×512, Vulkan, mmap, LCM-LoRA 1.0, LCM 4 steps, CFG 1.0

### 기본 VAE 병목 계측

| 구간 | Wall time | 프로세스 CPU time | CPU / Wall |
|---|---:|---:|---:|
| Loading | 0.51초 | 0.78초 | 152.4% |
| Encoding | 3.62초 | 5.14초 | 142.1% |
| Sampling | 57.91초 | 51.32초 | 88.6% |
| Decoding | 51.20초 | 22.81초 | 44.6% |
| PNG 저장 | 0.14초 | 0.18초 | 127.5% |
| Context 해제 | 0.26초 | 0.29초 | 112.9% |
| 전체 | 113.63초 | 80.52초 | 70.9% |

CPU / Wall은 프로세스의 모든 스레드 CPU 시간을 합산하므로 100%를 넘을 수 있습니다.
Decoding은 평균 한 코어의 절반보다 적은 CPU 시간을 사용하면서 51초가 걸렸고, 로그에서
`Vulkan0 Samsung Xclipse 960`, 1,984.06MB VAE compute buffer와 VRAM tensor 배치를
확인했습니다. 이는 CPU fallback이나 CPU↔GPU 복사보다 Xclipse의 Vulkan VAE graph 실행이
주요 병목이라는 강한 간접 증거입니다. UNet 준비 로그의 `copy_to_backend`는 0.03초였습니다.

### TAESD 최종 decode PoC

| 항목 | 기본 VAE 관측값 | TAESD 관측값 |
|---|---:|---:|
| Decoder 파라미터 VRAM | 159.68MB | 4.67MB |
| Compute buffer | 1,984.06MB | 480.06MB |
| Decode | 50~51초 | 0.62초 |
| 전체 생성 | 105~114초 | 66.14초 |

TAESD 적용은 `loading tae from ...`, `using TAE for encoding / decoding` 로그로
확인했습니다. Decode는 약 80배 빨라졌고 전체 생성은 약 40초 단축되었습니다. 다만
TAESD 결과는 기본 VAE보다 세부 형태, 질감과 선명도가 크게 저하되어 최종 이미지의 기본
decoder로 사용하기 어렵다고 판정했습니다.

각 실행은 프롬프트·seed와 일부 모델 형식이 동일하지 않은 기능 PoC이므로 전체 생성 시간은
엄밀한 동일 조건 benchmark가 아닙니다. Decoder 시간과 메모리 규모 차이는 병목 및
trade-off를 판단하기에 충분하지만, 최종 성능 수치는 동일 조건 반복 실험으로 갱신해야 합니다.

## Decision

1. `StableDiffusionBridge.cpp`의 `[perf]` 로그로 전체 및 단계별 wall time, CPU time,
   CPU/Wall 비율, RSS와 RSS 변화를 유지합니다.
2. GPU 사용률을 logcat 값으로 추정하지 않습니다. backend/device, VRAM 배치,
   CPU/Wall 비율과 upstream timing을 함께 해석합니다.
3. TAESD는 기본 최종 decoder로 채택하지 않습니다. `taesdUri`는 명시적으로 선택하는
   실험 옵션으로 유지하며, 선택하지 않으면 모델의 기본 VAE를 사용합니다.
4. TAESD를 빠른 preview로 사용하는 UX는 가능성이 있지만 현재 구현 범위에는 포함하지
   않습니다. Preview 뒤 기본 VAE 최종 decode가 필요하므로 총 연산량을 줄이는 해법은 아닙니다.
5. 품질을 유지하는 다음 실험은 기본 VAE의 Vulkan convolution 경로에 집중합니다.

## Alternatives Considered

### TAESD를 기본 최종 decoder로 사용

- Decode를 50초대에서 1초 미만으로 줄여 60초대 전체 생성에 도달합니다.
- 기본 VAE 대비 품질 저하가 커 Pocket Canvas의 최종 결과 기본값으로 채택하지 않습니다.

### TAESD preview 후 기본 VAE 최종 decode

- Sampling 직후 결과 구도를 빠르게 보여줄 수 있어 체감 대기 시간을 개선할 수 있습니다.
- 기본 VAE decode는 그대로 실행되므로 실제 완료 시간과 연산량은 줄지 않습니다.
- Preview UX 요구가 확정될 때 별도 결정으로 구현합니다.

### VAE tiling

- Peak memory와 큰 compute buffer를 줄이는 데 유리합니다.
- 512×512가 이미 실행 가능하며 tile 경계와 반복 실행 비용 때문에 속도 개선 수단으로는
  우선하지 않습니다.

### `vae_conv_direct`

- 동일 VAE 가중치와 출력 품질을 유지하면서 convolution 실행 경로를 바꿀 수 있습니다.
- backend에 따라 더 느릴 수 있으므로 Xclipse 960에서 A/B 측정할 다음 후보로 남깁니다.

### Perfetto 또는 Android GPU Inspector

- GPU counter와 scheduling을 더 직접적으로 관찰할 수 있습니다.
- 현재 logcat만으로 VAE graph 병목을 충분히 좁혔으므로, 기본 VAE 경로 비교에서 원인을
  더 분해해야 할 때 사용합니다.

## Consequences

- 성능 회귀는 전체 시간만이 아니라 단계별 `[perf]` 로그로 비교할 수 있습니다.
- `sampling_step`은 sampling 총 steps와 일치하는 callback만 계측하며 tensor loading
  callback을 step timing으로 오인하지 않습니다.
- TAESD 사용자는 별도 가중치를 가져와야 하며, 코드가 내장되어 있다는 이유만으로 가중치가
  앱에 번들됐다고 가정하면 안 됩니다.
- 기본 VAE 품질을 유지하는 한 약 50초 decode가 현재 가장 큰 단일 병목입니다.
- TAESD의 작은 메모리와 속도는 preview에 적합하지만 최종 품질 요구와는 맞지 않습니다.

