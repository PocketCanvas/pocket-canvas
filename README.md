# Pocket Canvas

**Android 기기에서 Stable Diffusion을 완전히 오프라인으로 실행하는 온디바이스 이미지 생성 앱**

Pocket Canvas는 사용자가 가져온 Stable Diffusion 모델과 LoRA를 외부 서버나 API 없이 Android 기기에서 직접 실행합니다. React Native로 사용자 경험과 로컬 저장소를 관리하고, `stable-diffusion.cpp`와 ggml/Vulkan으로 모델 로딩, 양자화, 이미지 생성을 수행합니다.

현재 프로젝트는 Galaxy S26에서 SD 1.5와 일부 SDXL 구성을 검증한 개발 단계입니다. 앱은 특정 모델을 번들하거나 모든 모델 조합의 성공을 보장하지 않으며, 사용자가 적절한 라이선스를 가진 호환 모델을 직접 가져오는 방식을 사용합니다.

## 주요 기능

### 온디바이스 이미지 생성

- GGUF 및 SafeTensors 체크포인트 실행
- Vulkan GPU backend와 mmap 모델 로딩
- 복수 LoRA 적용, 순서 변경 및 개별 가중치 설정
- 23개 sampler/scheduler preset
- 해상도, steps, CFG, seed, negative prompt 설정
- 8개 내장 Hires 방식과 1.5×~4.0× 업스케일
- 선택적 TAESD decoder
- Loading, Encoding, Sampling, Decoding 단계별 진행 표시
- 결과 PNG와 현행 생성 옵션 전체를 앱 저장소에 보존

### 모델 관리와 양자화

- Android 문서 선택기를 통한 모델 및 LoRA 가져오기
- 파일명뿐 아니라 GGUF/SafeTensors header를 이용한 형식 검증
- tensor 구조 기반 Model/LoRA 자동 분류와 사용자 수동 분류
- alias, 설명, 분류 변경 및 삭제
- float SafeTensors/GGUF 모델의 온디바이스 streaming 양자화
- Q8_0, Q5_0, Q5_1, Q4_0, Q4_1, Q4_K 출력 지원
- 원본 보존, 임시 GGUF 검증, 실패 시 롤백
- 완료 tensor 수 기반 양자화 진행률

### 히스토리(갤러리)

- 생성 이미지 3열 그리드와 전체/즐겨찾기 필터
- 최신순/오래된순 정렬과 검색
- 전체 화면 좌우 탐색, 핀치 확대 및 확대 후 이동
- 이미지 공유, 즐겨찾기, 상세 metadata 확인 및 삭제
- metadata 기록에 실패한 PNG를 삭제하지 않고 `missing` 항목으로 복구

### 모바일 메모리 정책

Pocket Canvas는 모델 이름 whitelist 대신 header에서 얻은 모델 family, variant 근거, component별 저장 타입과 추정 크기를 생성 workload와 조합합니다. 네이티브 bridge는 이 정보로 다음 중 하나의 실행 정책을 선택합니다.

- `verified`: Galaxy S26 실기기에서 검증된 정확한 조합
- `conservative`: 모델 구조와 메모리 비용에 따른 보수적 설정
- `native-default`: 근거가 부족할 때 upstream 기본 동작 유지

정책은 diffusion flash attention, parameter backend와 VAE tiling을 조정하지만 sampler, 해상도 같은 사용자 설정을 변경하지 않습니다. 실패 후 자동 fallback이나 미검증 조합의 사전 거절도 수행하지 않습니다. 판정 근거와 적용 결과는 `[model]`, `[settings]` 로그에서 확인할 수 있습니다.

자세한 내용은 [ADR-017](docs/decisions/ADR-017-evidence-based-vae-memory-policy.md)과 [ADR-018](docs/decisions/ADR-018-model-descriptor-memory-policy-resolution.md)을 참고하세요.

## 아키텍처

```text
React Native / Expo
        │
        ▼
TypeScript module contract
        │
        ▼
Expo Module (Kotlin)
        │ JNI
        ▼
StableDiffusionBridge.cpp
        │
        ▼
stable-diffusion.cpp
        │
        ▼
ggml / Vulkan
```

- React Native는 화면, 생성 상태, 모델·이미지 영속화와 전역 작업 조정을 담당합니다.
- TypeScript 모듈은 앱과 네이티브 모듈 사이의 공개 계약을 제공합니다.
- Kotlin은 앱 저장소 경로와 API 계약을 검증하고, 긴 JNI 호출을 Expo 공용 큐와 분리된 전용 큐에서 실행합니다.
- `StableDiffusionBridge.cpp`는 생성·양자화 직렬화, 메모리 정책, sampler/hires 변환, 진행 이벤트와 PNG 저장을 담당합니다.
- `stable-diffusion.cpp`는 git submodule로 관리하며 Pocket Canvas에서 직접 수정하지 않습니다.

생성과 양자화는 동시에 실행되지 않습니다. JS의 즉시 거절, SQLite commit queue, Kotlin 전용 실행 큐와 C++ mutex가 서로 다른 계층의 동시성 문제를 방지합니다.

상세 구조와 결정 배경은 [Architecture](docs/architecture.md)와 [Architecture Decision Records](docs/decisions)를 참고하세요.

## 기술 스택

| 영역        | 기술                                                  |
| ----------- | ----------------------------------------------------- |
| 앱          | Expo SDK 57, React 19, React Native 0.86, TypeScript  |
| UI·상태     | Expo Router, Zustand, Gesture Handler, Reanimated     |
| Android     | Kotlin, Expo Modules API, JNI, Android NDK 27.1       |
| 추론        | C++17, stable-diffusion.cpp, ggml, Vulkan, mmap       |
| 저장소      | expo-sqlite 메타데이터, Expo FileSystem 모델·PNG     |
| 릴리즈 빌드 | Docker BuildKit, JDK 17, Android API 36, CMake 3.22.1 |

정확한 패치 버전은 루트와 [`stable-diffusion/package.json`](stable-diffusion/package.json)을 함께 확인하세요. 두 패키지의 Expo, React와 React Native는 같은 호환 세대를 유지해야 합니다.

## 저장소 구조

```text
.
├─ src/
│  ├─ app/                         # Expo Router 화면과 orchestration
│  ├─ components/                  # 생성·모델·히스토리 UI
│  ├─ lib/                         # 파일 검사, 영속화, reducer와 queue
│  └─ stores/                      # 테마와 전역 무거운 작업 상태
├─ stable-diffusion/
│  ├─ src/                         # Expo module TypeScript API
│  ├─ android/                     # Kotlin module과 Android 빌드 설정
│  └─ cpp/
│     ├─ StableDiffusionBridge.cpp # Pocket Canvas 전용 네이티브 로직
│     └─ stable-diffusion.cpp/     # upstream git submodule
├─ docs/
│  ├─ architecture.md
│  ├─ CMakeLists.txt                 # ggml-vulkan Android 빌드 workaround 보존본
│  ├─ troubleshooting.md
│  └─ decisions/                   # ADR-001 ~ ADR-020
├─ scripts/                        # Docker 릴리즈 APK 진입점
├─ Dockerfile.android
└─ AGENTS.md
```

## 시작하기

### 요구 사항

- Node.js 22 권장
- npm
- JDK 17
- Android Studio와 Android SDK
- Android NDK `27.1.12297006`
- USB debugging이 활성화된 arm64 Android 기기
- git submodule을 내려받을 수 있는 환경

Vulkan 네이티브 모듈을 사용하므로 Expo Go에서는 실행할 수 없습니다.

### 설치

```bash
git clone --recurse-submodules https://github.com/PocketCanvas/pocket-canvas.git
cd pocket-canvas

cd stable-diffusion
npm install
npm run build
cd ..

npm install
```

기존 clone에서 submodule이 비어 있다면 다음 명령으로 초기화합니다.

```bash
git submodule update --init --recursive
```

### ggml-vulkan CMake workaround 적용

Windows에서 Android NDK 대상으로 Vulkan backend를 교차 컴파일할 때 `ggml-vulkan`이 `SPIRV-Headers` package를 찾지 못할 수 있습니다. [ADR-002](docs/decisions/ADR-002-vulkan-ndk-build.md)의 임시 fallback이 적용된 [`docs/CMakeLists.txt`](docs/CMakeLists.txt)를 저장소에 보존합니다.

새 clone, submodule 초기화 또는 submodule 업데이트 후에는 upstream 파일이 복원되어 workaround가 사라질 수 있습니다. 이 경우 네이티브 빌드 전에 보존본으로 다음 파일을 교체하세요.

```text
stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt
```

Git Bash:

```bash
cp docs/CMakeLists.txt \
  stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt
```

PowerShell:

```powershell
Copy-Item -LiteralPath docs/CMakeLists.txt `
  -Destination stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt `
  -Force
```

교체 후 submodule이 dirty 상태로 표시되는 것은 의도된 상태입니다. 이 local modification을 revert하거나 reset하지 마세요. fallback은 먼저 설치된 `SPIRV-Headers` package를 탐색하고, 찾지 못한 경우에만 KhronosGroup의 저장소를 가져옵니다. 따라서 fallback 경로를 사용하면 CMake 구성 시 네트워크 연결이 필요할 수 있습니다.

### Android 개발 빌드 실행

```bash
npx expo run:android
```

Android 빌드는 `arm64-v8a`만 지원합니다. 앱의 manifest min SDK와 별개로 C++ target API는 CMake `ANDROID_PLATFORM=28`로 설정됩니다.

## 개발 명령

| 목적              | 명령                                                          |
| ----------------- | ------------------------------------------------------------- |
| Android 앱 실행   | `npx expo run:android`                                        |
| TypeScript 검사   | `npx tsc --noEmit`                                            |
| 앱 린트           | `npm run lint`                                                |
| 단위 테스트       | `npm run test:model-files`                                    |
| 포맷 검사         | `npm run format:check`                                        |
| 포맷 적용         | `npm run format`                                              |
| Expo 호환성 검사  | `npx expo install --check`                                    |
| 프로젝트 진단     | `npx expo-doctor`                                             |
| Expo 모듈 TS 빌드 | `cd stable-diffusion && npm run build`                        |
| Android 모듈 빌드 | `cd android && .\gradlew.bat :stable-diffusion:assembleDebug` |
| C++ 로그 확인     | `adb logcat -s StableDiffusionBridge:I '*:S'`                 |

`stable-diffusion/src/`를 변경했다면 반드시 해당 디렉터리에서 `npm run build`를 다시 실행해야 합니다. 앱은 모듈의 빌드 결과를 참조합니다.

## Docker 릴리즈 APK

호스트 Android/Vulkan 도구 체인 차이를 줄이기 위해 Docker 기반 release 빌드를 제공합니다. 기준 진입점은 **Git Bash** 입니다.

```bash
./scripts/build-release-apk.sh
```

성공한 APK는 다음 위치에 생성됩니다.

```text
artifacts/android/pocket-canvas-release.apk
```

현재 release 변형은 개인 기기 시험을 위해 기존 Android debug keystore로 서명됩니다. Play Store 배포용 APK가 아닙니다. 최초 빌드는 Android SDK/NDK와 npm 의존성 다운로드 및 C++ 컴파일 때문에 오래 걸릴 수 있습니다.

자세한 사용법은 [Docker Android release build](docs/docker-release-build.md), 오류별 복구법은 [Troubleshooting](docs/troubleshooting.md)을 참고하세요.

## 검증된 결과와 한계

Galaxy S26에서 다음 경로가 검증되었습니다.

- SD 1.5 Q4_K + LCM-LoRA, 512×512, 4 steps 생성
- Vulkan backend, mmap, LoRA 적용과 PNG 출력
- SDXL Turbo Q4 768×768의 48×48 VAE tiling
- SDXL Turbo float 512×512의 flash attention + CPU parameter backend

초기 SD 1.5 Q4_K + LCM-LoRA PoC는 전체 약 116초로 기능 검증에는 성공했지만 60초 성능 목표에는 미달했습니다. 당시 sampling과 VAE decode가 각각 약 54초와 57초였으며, VAE decode가 주요 병목으로 확인되었습니다.

23개 sampling preset과 8개 Hires 방식은 네이티브 빌드까지 검증됐지만 모든 모델·옵션 조합의 실기기 성공, 품질과 메모리를 보장하지 않습니다. TAESD도 별도 SD 1.x 가중치가 필요하며 최종 품질 문제로 기본 decoder로 채택하지 않았습니다.

실험 결과는 [ADR-003](docs/decisions/ADR-003-poc-benchmark-results.md), [ADR-009](docs/decisions/ADR-009-generation-profiling-and-taesd-poc.md), [ADR-017](docs/decisions/ADR-017-evidence-based-vae-memory-policy.md), [ADR-018](docs/decisions/ADR-018-model-descriptor-memory-policy-resolution.md)에 기록되어 있습니다.

## 모델과 개인정보

Pocket Canvas는 모델이나 LoRA를 자체 배포하지 않습니다. 사용자는 자신이 사용할 권한이 있는 호환 파일을 직접 가져와야 하며, 각 파일의 라이선스와 사용 조건은 해당 제공자가 정한 내용을 따릅니다.

모델, 생성 요청과 결과 이미지는 앱의 로컬 document storage에 저장되고 추론 과정에서 외부 생성 API로 전송되지 않습니다. 다만 패키지 설치, submodule 초기화와 Docker 이미지 빌드에는 네트워크가 필요합니다.

## 기여하기

기여 방법과 개발 시 지켜야 할 경계는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고해 주세요.

## 라이선스

Pocket Canvas 자체 코드는 [LICENSE](LICENSE)를 따릅니다. `stable-diffusion.cpp`와 사용자가 가져온 모델·LoRA에는 각각 별도의 라이선스가 적용될 수 있습니다.
