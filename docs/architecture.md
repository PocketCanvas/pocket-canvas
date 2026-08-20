# Pocket Canvas Architecture

## Overview
Pocket Canvas는 Android에서 Stable Diffusion inference를 온디바이스로 실행하는 Expo + React Native 애플리케이션

JS/UI 계층은 Expo Modules API를 통해 Kotlin native module을 호출하고, Kotlin은 JNI bridge를 통해 `stable-diffusion.cpp` 기반 C++ inference core와 통신한다

```text
React Native / Expo
        │
        ▼
Expo Module (Kotlin)
        │
       JNI
        │
        ▼
StableDiffusionBridge.cpp
        │
        ▼
stable-diffusion.cpp
        │
        ▼
ggml / Vulkan
```

`stable-diffusion.cpp`는 git submodule로 관리하며 Pocket Canvas의 custom native logic은 bridge 계층에서 구현

## Generation flow

```text
Prompt / Model / LoRA / Steps / Optional TAESD
            │
            ▼
        React Native
            │
            ▼
       Expo Module
            │
            ▼
           JNI
            │
            ▼
      C++ inference
            │
            ├─ Loading
            ├─ Encoding
            ├─ Sampling
            └─ Decoding
            │
            ▼
        PNG storage
            │
            ▼
      React Native UI
```

1. JS에서 생성 요청을 구성
2. Kotlin 계층에서 앱 storage URI 등 native boundary를 검증
3. JNI bridge가 inference context를 생성
4. stable-diffusion.cpp가 Vulkan backend에서 inference를 수행
5. bridge가 생성 단계를 JS progress event로 변환
6. 생성 결과를 앱 document storage에 PNG로 저장
7. JS가 결과 URI와 metadata를 UI/history에 반영

> 상세 내용은 ADR-007 참조

TAESD를 선택하면 별도 가중치 경로가 TS → Kotlin → JNI 계약을 통해
`sd_ctx_params_t.taesd_path`로 전달되고 최종 decode의 기본 VAE를 대체한다. TAESD는
실험 옵션이며 품질 저하 때문에 기본값으로 사용하지 않는다. → ADR-009

## Native boundary
1. Expo module: JS 에 asynchronous native API와 event interface를 제공
2. Kotlin: Android lifecycle, URI/storage validation 및 JNI 호출을 담당
3. JNI bridge: Pocket Canvas 전용 inference orchestration과 `stable-diffusion.cpp` API adaptation을 담당한다.
4. stable-diffusion.cpp: 실제 model loading 및 diffusion inference를 수행하는 upstream core

## Persistence

```text
Paths.document/
├── models/
│   ├── models.json
│   ├── <내부 ID>.safetensors
│   └── <내부 ID>.gguf
└── images/
    ├── meta.json
    └── YYYYMMDD-HHMMSS-<id>.png
```
* `models/`: imported model 및 LoRA 와 metadata
* `images/`: generated PNG와 현행 생성 옵션 전체를 포함하는 metadata

> 가져오기는 validation 후 commit하며 실패한 import가 정상 데이터에 영향을 주지 않도록 rollback 가능한 흐름을 사용
>
> PNG 보존을 우선한다. metadata 기록이 실패한 PNG는 디렉터리 스캔으로 복구하되, 알 수 없는 생성 설정을 합성하지 않고 `missing` 상태로 히스토리에 표시한다. → ADR-012


## UI boundaries

React Native가 화면 구성과 상태 orchestration을 담당

Native interaction의 이점이 있는 일부 control만 Expo UI를 사용하며, 앱 전체 navigation과 layout은 React Native 계층에 유지

History UI와 생성 UI는 화면 state와 reusable presentation component의 책임을 분리

→ ADR-005
→ ADR-008
