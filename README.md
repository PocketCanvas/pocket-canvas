# Pocket Canvas

**Android에서 Stable Diffusion을 온디바이스로 실행하기 위한 오픈소스 이미지 생성 앱**

Pocket Canvas는 Stable Diffusion 모델을 서버나 외부 API 없이 **Android 기기 안에서 직접 실행하는 것을** 목표로 합니다.

모델 로딩부터 이미지 생성까지의 추론 과정은 C++ 기반의 [`stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp)를 사용하며, Vulkan을 통해 Android GPU에서 실행합니다.

> 사용자가 모델을 가져와 외부 서버 없이 사용할 수 있는 Android용 로컬 이미지 생성 환경을 목표로 합니다.

---

## Why Pocket Canvas?

**요즘 스마트폰의 GPU 성능은 빠르게 발전하고 있는데, 이 연산 능력을 더 적극적으로 활용할 수는 없을까?**

Pocket Canvas는 이 질문에서 시작했습니다. 서버 대신 사용자의 Android 기기에서 이미지 생성 모델을 직접 실행하고, 모바일 하드웨어가 로컬 생성형 AI를 어디까지 감당할 수 있는지 탐구합니다.

- 모바일 GPU로 Stable Diffusion을 어느 수준까지 실행할 수 있는가?
- 제한된 RAM과 메모리 대역폭 안에서 대형 모델을 어떻게 다룰 것인가?
- Vulkan 기반 inference를 실제 Android 앱 경험으로 연결할 수 있는가?
- quantization, mmap, 적은 sampling steps 같은 기법이 모바일 환경에서 얼마나 효과적인가?

---

## Current Features

현재 Pocket Canvas에서는 다음 기능을 구현하고 있습니다.

### Image generation

- Android 기기에서 Stable Diffusion 추론
- Vulkan GPU backend
- GGUF / SafeTensors 모델 가져오기
- LoRA 가져오기 및 적용
- 여러 LoRA 선택 및 가중치 설정
- inference steps 설정
- 생성 진행 단계 표시
  - Loading
  - Encoding
  - Sampling
  - Decoding

### Model management

- Android 파일 선택기를 통한 모델 가져오기
- GGUF / SafeTensors 실제 파일 형식 검증
- Model / LoRA 자동 분류
- 사용자 alias 및 description 관리
- 앱 전용 저장소를 이용한 모델 보관
- 실패한 import rollback

### Generation history

- 생성 이미지 영구 저장
- 생성 설정 metadata 기록
- 히스토리 그리드
- 검색 및 정렬
- 즐겨찾기
- 이미지 공유
- metadata에 없는 고아 이미지 복구

---

## Architecture

Pocket Canvas는 React Native UI에서 C++ inference core까지 다음 경로로 연결됩니다.

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

React Native는 UI와 앱 상태를 담당하고, Kotlin은 Android native boundary와 JNI 연결을 담당합니다.

Pocket Canvas 전용 C++ integration은 `StableDiffusionBridge.cpp`에서 처리하며, 실제 모델 로딩과 diffusion inference는 upstream `stable-diffusion.cpp`에 위임합니다.

`stable-diffusion.cpp`는 git submodule로 관리하며 upstream 코어를 직접 수정하지 않는 것을 원칙으로 합니다.

자세한 내용은 [Architecture](docs/architecture.md)를 참고하세요.

---

## Tech Stack

### Application

- Expo
- React Native
- React
- TypeScript

### Android / Native

- Kotlin
- Expo Modules API
- JNI
- Android NDK
- C++

### Inference

- stable-diffusion.cpp
- ggml
- Vulkan
- mmap

현재 사용 중인 정확한 dependency 버전은 [`package.json`](package.json)을 기준으로 합니다.

---

## Repository Structure

```text
.
├── src/                              # React Native application
├── stable-diffusion/
│   ├── src/                          # Expo module TypeScript interface
│   ├── android/                      # Kotlin / Android native module
│   └── cpp/
│       └── stable-diffusion.cpp/     # upstream git submodule
│
├── docs/
│   ├── architecture.md
│   ├── troubleshooting.md
│   └── decisions/                    # Architecture Decision Records
├── android/
└── AGENTS.md                         # AI coding agent instructions
```

---

## Getting Started

### Requirements

Android native build 환경이 필요합니다.

- Node.js
- npm
- Android Studio
- Android SDK
- Android NDK
- JDK
- Android 기기 또는 개발 환경

프로젝트를 submodule과 함께 clone합니다.

```bash
git clone --recurse-submodules https://github.com/PocketCanvas/pocket-canvas.git
cd pocket-canvas
npm install
```

로컬 Expo module의 dependency도 설치합니다.

```bash
cd stable-diffusion
npm install
npm run build
cd ..
```

Android 앱을 빌드하고 실행합니다.

```bash
npx expo run:android
```

> Pocket Canvas는 native C++/Vulkan 모듈을 사용하므로 Expo Go만으로 실행할 수 없습니다.

---

## Development

```bash
npx tsc --noEmit
npm run lint
npm run format:check
npx expo install --check
npx expo-doctor
```

로컬 Expo module의 TypeScript 코드를 수정했다면 다시 빌드해야 합니다.

```bash
cd stable-diffusion
npm run build
```

> Android native build 문제는 [Troubleshooting](docs/troubleshooting.md)을 먼저 확인하세요.

---

## Models

Pocket Canvas 자체는 Stable Diffusion 모델 파일을 배포하는 것을 목표로 하지 않습니다.

사용자는 자신이 사용할 권한을 가진 호환 모델과 LoRA를 직접 가져와야 합니다.

현재 앱은 파일 형식과 모델 종류에 대한 기본 검증을 수행하지만, **모든 모델과 LoRA 조합의 실제 inference 호환성을 보장하지는 않습니다.**

모델 파일의 라이선스와 사용 조건은 각 모델 제공자가 정한 조건을 따릅니다.

---

## Performance

온디바이스 Stable Diffusion은 모바일 환경에서 상당한 연산량과 메모리를 요구합니다.

Pocket Canvas는 quantization, 적은 sampling steps, LCM, mmap, Vulkan, VAE decode 최적화 등을 실험하고 있습니다.

목표는 **실제로 사용할 수 있는 수준까지 모바일 inference 비용을 낮추는 것** 입니다.

서버 GPU나 데스크톱 GPU 수준의 생성 속도를 목표로 하지는 않습니다.

---

## Architecture Decisions

주요 기술적 결정과 검토했던 대안, trade-off는 [Architecture Decision Records](docs/decisions)에 기록합니다.

---

## Contributing

Pocket Canvas는 오픈소스 프로젝트입니다.

버그 수정, Android 기기별 테스트, Vulkan 호환성 조사, UI 개선, 문서 개선 등 다양한 형태의 기여를 환영합니다.

특히 native 영역을 변경하기 전에는 다음 문서를 확인해주세요.

- [`AGENTS.md`](AGENTS.md)
- [`docs/architecture.md`](docs/architecture.md)
- 관련 [`docs/decisions/`](docs/decisions) ADR

`stable-diffusion.cpp` submodule의 upstream 코드는 Pocket Canvas에서 직접 수정하지 않는 것을 기본 원칙으로 합니다.

---

## What Pocket Canvas Is Not

Pocket Canvas는 다음을 목표로 하지 않습니다.

- 클라우드 Stable Diffusion 서비스
- 특정 모델 제공자를 위한 전용 클라이언트
- 자체 diffusion model 개발

---

## License

Pocket Canvas 자체의 라이선스는 저장소의 [`LICENSE`](LICENSE)를 참고하세요.

`stable-diffusion.cpp` 및 사용자가 가져오는 모델·LoRA에는 각각 별도의 라이선스가 적용될 수 있습니다.
