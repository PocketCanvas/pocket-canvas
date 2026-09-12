# ADR-028: S20+ ONNX Runtime 생성 PoC

## Status

Accepted

ggml Vulkan/CPU 경로(ADR-018, ADR-027)를 대체하지 않는다. S20+에서 Vulkan
SIGSEGV와 ggml CPU 869초를 우회할 수 있는지 검증한 PoC 결정이다.

## Date

2026-09-12

## Context

기기 지원 하한선을 Galaxy S20+(Adreno 650)로 두면 기존 `stable-diffusion.cpp`는
제품 경로가 아니다.

- Vulkan: params alloc SIGSEGV. 서브모듈을 고쳐 우회하지 않는다. → ADR-018, ADR-022
- 설정 CPU(ggml CPU only): 256×256 LCM 2 steps가 869.13초. 512×512는 sampling 중
  사용자가 중지. → ADR-027

ONNX Runtime Android AAR은 ggml Vulkan과 다른 스택이다. 게시된
`onnxruntime-react-native` 1.24.3은 이 앱의 Expo SDK 57 / Gradle 9와 맞지 않는다
(`VersionNumber.parse`, `unimodule.json` autolinking). 그 접착제를 쓰기 위해 Expo를
내리면 ADR-004를 깨는 비용이 더 크다.

검증 질문은 “JS에서 ORT 세션 API가 있는가”가 아니라 **S20+에서 이미지가 나오는지,
ggml CPU보다 쓸 수 있는지**다.

## Decision

- Maven `com.microsoft.onnxruntime:onnxruntime-android:1.24.3`을 Expo 모듈에 링크한다.
  퀄컴 SDK, QNN AAR, ORT 소스 빌드는 PoC 범위가 아니다. 측정된 기준 백엔드는 ORT CPU다.
  실험 화면에서 CPU / XNNPACK / NNAPI를 고를 수 있다. QNN은 이 AAR에 없다.
- `onnxruntime-react-native`를 넣지 않는다. 설정 탭의 Vulkan/CPU 옆에 ONNX를 세 번째
  백엔드로 두지 않는다. ggml 생성 탭 draft/run과도 섞지 않는다. → ADR-016, ADR-027
- 전용 화면 `onnx-poc`만 둔다. 설정에서 진입한다. 모델 카탈로그·ZIP 가져오기·히스토리
  기록은 하지 않는다.
- 파이프라인은 하드코딩한다. 대상은 Chilloutmix INT8 `.ort` 세 파일
  (`text_encoder`, `unet`, `vae_decoder`)과 CLIP tokenizer다. 가중치는 저장소에 넣지
  않고 `Chilloutmix/` gitignore + `./scripts/push-poc-onnx.sh`로 기기
  `Android/data/.../files/poc-chilloutmix`에 복사한다.
- Kotlin `OnnxPocGenerator`가 CLIP tokenize, DDIM 20 steps, CFG 7, VAE decode, PNG
  쓰기를 담당한다. 세션은 encoding → sampling → decoding 순으로 열고 닫아 피크
  메모리를 줄인다. 생성은 `nativeOperationQueue`에서 돌린다. → ADR-015
- 단계 시간은 logcat 태그 `OnnxPoc`만 남긴다. prompt·경로·seed는 넣지 않는다.
  → ADR-025
- 이 수치를 `MemoryPolicy`의 `verified`로 올리지 않는다. ggml 기본 경로를 바꾸지
  않는다.

## Alternatives Considered

### `onnxruntime-react-native` npm + Expo 플러그인

JS `InferenceSession`은 작은 모델용이다. SD latent를 JS TypedArray로 넘기면 복사가
병목이다. 게시된 1.24.3은 Gradle 9와 Expo autolinking에서 막힌다. Expo를 내려
우회하는 비용이 더 크다.

### 설정에 Vulkan / CPU / ONNX 3지선다

Vulkan/CPU는 같은 ggml 엔진의 연산 백엔드고, ONNX는 모델 포맷·세션·스케줄러가
다르다. 생성 탭은 계속 GGUF를 고르게 되어 선택이 실행과 끊긴다.

### 모델 탭에서 ONNX 파이프라인 ZIP을 카탈로그 한 행으로 관리

제품화에는 맞지만, 세션이 열리는지·한 장이 나오는지보다 먼저 만들 일이 아니다.

### QNN HTP / NNAPI를 첫 가속으로 채택

S20+ Hexagon은 v66이라 Local Dream 등 SD1.5 NPU 타깃(V68+) 밖이다. NNAPI GPU는
실기기 할당 로그가 필요하다. 첫 기능 기준은 CPU에서 그림이 나오는 것이다.

### ADR-023대로 생성 루프를 즉시 C++로 작성

제품 경로라면 맞다. PoC는 Maven AAR Java API로 세션 로드와 한 장을 더 빨리 관측할
수 있었다. ggml 책임 분리 규칙은 유지한다.

## Consequences

- S20+에서 ORT CPU 생성은 기능적으로 성립한다. ggml CPU 869초(256², 2 steps)와 같은
  기기의 하한선 문제를 이 경로가 완화한다.
- 생성 탭·설정 Vulkan/CPU·MemoryPolicy는 그대로다. ONNX는 실험 화면에서만 돈다.
- `.ort`는 2023 포맷이다. ORT 1.24에서 열린 것은 이 묶음에 한한다.
- Android `Pattern.UNICODE_CHARACTER_CLASS`는 쓰지 않는다. Git Bash `adb`는
  `MSYS_NO_PATHCONV=1` 없이 `/sdcard`를 `C:\Program Files`로 바꾼다.
- NNAPI와 XNNPACK은 화면에서 고를 수 있지만, 기능 기준 시간은 CPU 로그다. QNN, LoRA,
  카탈로그, 히스토리 연동은 후속이다.

## Validation

Galaxy S20+(`SM-G986N`, Android 13, Adreno 650). 모델은 Chilloutmix INT8 `.ort`
파이프라인. ORT 1.24.3 CPU, DDIM, CFG 7, seed 42, 20 steps. logcat `OnnxPoc`.

CFG라 sampling 1스텝은 UNet 순방향 2회다.

### 256×256

`generate start 256x256 steps=20 cfg=7.0` … `generate done 40526ms`

| 단계 | 시간 |
|---|---:|
| encoding (CLIP) | 1,622ms |
| UNet 로드 | 3,946ms |
| sampling 20 steps 합 | 31,446ms (스텝당 1,463–1,666ms) |
| decoding (VAE) + PNG | 3,378ms |
| **전체** | **40,526ms** |

latent `32×32`. CLIP hidden 59,136 floats (`77×768`).

### 512×512

`generate start 512x512 steps=20 cfg=7.0` … `generate done 228439ms`

| 단계 | 시간 |
|---|---:|
| encoding (CLIP) | 1,657ms |
| UNet 로드 | 3,962ms |
| sampling 20 steps 합 | 207,558ms (스텝당 9,197–10,831ms) |
| decoding (VAE) + PNG | 14,826ms |
| **전체** | **228,439ms** |

latent `64×64`. 출력 `512×512`. sampling 1–9스텝은 9.2–10.1초, 10–20스텝은
10.7–10.8초로 붙는다. 면적 4배에 sampling 약 6.6배인 이유다.

같은 기기 ggml CPU 256×256 LCM 2 steps 869.13초와 직접 모델·스텝이 같지는 않다.
그래도 S20+에서 **한 장이 1분 안(256²) / 약 4분(512²)** 에 끝나는 경로는 ggml CPU와
비교할 수 있는 기능 기준이다.

확인: `adb logcat -s OnnxPoc:I`

## References

- [ADR-003](ADR-003-poc-benchmark-results.md)
- [ADR-015](ADR-015-heavy-operation-coordination.md)
- [ADR-016](ADR-016-generation-screen-state-model.md)
- [ADR-018](ADR-018-model-descriptor-memory-policy-resolution.md)
- [ADR-023](ADR-023-native-module-responsibility-split.md)
- [ADR-025](ADR-025-crash-log-data-minimization.md)
- [ADR-027](ADR-027-ggml-cpu-inference-backend.md)
