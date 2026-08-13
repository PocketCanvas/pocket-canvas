# Pocket Canvas — AI 에이전트 지침 (AGENTS.md)

> 코드를 작성하거나 아키텍처를 변경하기 전에 반드시 숙지하세요.

## 프로젝트 개요
안드로이드 기기에서 **C++ 코어(stable-diffusion.cpp)**를 활용하여 Stable Diffusion 모델을 온디바이스로 구동하는 앱입니다.
- **프레임워크:** React Native 0.86.2 + Expo SDK 57 (New Architecture)
- **네이티브:** Kotlin(Expo Modules) → JNI → C++(stable-diffusion.cpp, git submodule)
- **GPU:** Vulkan 1.1, 모델 로딩: mmap
- **아키텍처 상세:** [docs/architecture.md](docs/architecture.md) 참조

## 핵심 원칙

1. **서브모듈 수정 금지.** `stable-diffusion/cpp/stable-diffusion.cpp/` 내부의 코드는 절대 수정하지 않습니다. 커스텀 로직은 `StableDiffusionBridge.cpp`에서만 작성하세요.
2. **점진적 검증 (Step-by-Step PoC).** 복잡한 구조를 한 번에 설계하지 마세요. 작은 단위로 빌드하고, 빌드가 성공하는지 확인한 뒤 다음 단계로 넘어가세요.
3. **소스 주도 개발.** Expo SDK 57 / React Native 0.86.2의 최신 아키텍처를 사용 중입니다. 구형 지식에 의존하지 말고, 반드시 [공식 문서](https://docs.expo.dev/versions/v57.0.0/)를 확인하세요.
4. **성능 최우선.** 메모리, 배터리, 빌드 속도를 항상 고려하세요.

## 명령어

| 목적 | 명령어 |
|---|---|
| 앱 실행 (Android) | `npx expo run:android` |
| TS 모듈 빌드 | `cd stable-diffusion && npm run build` |
| 클린 빌드 | `cd android && ./gradlew clean` |
| 모델 전송 | `adb push <model>.safetensors /data/user/0/com.anonymous.pocketcanvas/files/` |
| C++ 로그 모니터링 | `adb logcat -s StableDiffusionBridge:I *:S` |

## 아키텍처 결정 기록 (ADRs)

상세 내용은 각 문서를 참조하세요:

| ADR | 제목 | 핵심 |
|---|---|---|
| [ADR-001](docs/decisions/ADR-001-native-module-architecture.md) | 네이티브 모듈 구조 | Expo Modules API + JNI + git submodule |
| [ADR-002](docs/decisions/ADR-002-vulkan-ndk-build.md) | Vulkan NDK 빌드 | `ANDROID_PLATFORM=28`, `arm64-v8a` only |
| [ADR-003](docs/decisions/ADR-003-poc-benchmark-results.md) | SD 1.5 PoC 결과 | Q4_K + LCM-LoRA 기능 PoC 성공, 전체 116초 |

## 절대 하지 말 것 (Boundaries)

- ❌ `stable-diffusion.cpp` 서브모듈 내부 코드 수정
- ❌ 모듈의 `build.gradle`에 `minSdkVersion` 직접 선언 (루트 상속, CMake 인자로만 처리)
- ❌ `react-native` 버전을 루트와 모듈 간 불일치시키기
- ❌ `stable-diffusion/src/` TS 수정 후 `npm run build` 없이 테스트

### ⚠️ 임시 서브모듈 수정 예외
Android Vulkan 크로스컴파일 시 SPIRV-Headers 탐색 오류를 우회하기 위해 다음 업스트림 파일에 로컬 수정이 적용되어 있습니다.

`stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt` 이 변경은 의도된 dirty 상태입니다. 임의로 원복하거나 서브모듈을 초기화하지 마세요. 자세한 배경과 제거 조건은 `ADR-002` 를 참조하세요.

## 알려진 이슈 (Gotchas)

### 🚨 터보모듈 크래시: `NativeMicrotasksCxx could not be found`
- **원인:** 루트와 로컬 모듈 간 `react-native` 버전 불일치
- **해결:** 모든 `package.json`의 `react-native` 버전을 100% 일치시키고 `npm install` 재실행

### 🔄 TS 모듈 변경 미반영
- **원인:** 앱은 `stable-diffusion/build/index.js`를 참조 (TS 원본이 아님)
- **해결:** `cd stable-diffusion && npm run build` 실행

### 🛠️ Manifest Merger 에러: `minSdkVersion 24 < 28`
- **원인:** 모듈에서 `minSdkVersion 28`을 직접 선언하면 루트(24)와 충돌
- **해결:** 모듈에서 `minSdkVersion` 제거, CMake에 `-DANDROID_PLATFORM=28`만 사용

### 💥 32비트 빌드 에러: `vk::Buffer` 관련 C++ 템플릿 에러
- **원인:** `vulkan.hpp`가 32비트에서 핸들을 `uint64_t`로 처리 → 타입 호환성 깨짐
- **해결:** `ndk { abiFilters 'arm64-v8a' }` — 64비트 전용

### ⚠️ 16KB 페이지 사이즈 경고
- **증상:** Android 15+ 기기에서 ELF 정렬 경고 (`libreanimated.so` 등)
- **대응:** RN 생태계 과도기 현상. 기능에 영향 없음. **무시할 것.**
