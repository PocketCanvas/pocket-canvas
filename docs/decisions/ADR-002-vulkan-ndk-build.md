# ADR-002: Android NDK 빌드 및 Vulkan 1.1 통합 전략

## Status
Accepted

## Date
2026-08-12

## Context
Pocket Canvas 앱은 온디바이스에서 AI 모델을 렌더링하기 위해 `stable-diffusion.cpp`와 `ggml-vulkan` 백엔드를 사용합니다. 이 과정에서 안드로이드 NDK를 통한 C++ 라이브러리(`libstable_diffusion_bridge.so`) 컴파일 시 다음과 같은 두 가지 주요한 문제가 발생했습니다.

1. **Vulkan 1.1 심볼 링킹 에러 (`vkGetPhysicalDeviceFeatures2`):**
   Expo의 기본 `minSdkVersion`은 24(Android 7.0)입니다. 하지만 `ggml-vulkan`은 Vulkan 1.1 이상의 기능을 요구하며, NDK의 API 레벨 24용 `libvulkan.so`에는 `vkGetPhysicalDeviceFeatures2` 같은 1.1 전용 심볼이 존재하지 않아 링킹(ld.lld) 에러가 발생했습니다.

2. **32비트(armeabi-v7a) 호환성 문제:**
   Android Gradle Plugin은 기본적으로 `arm64-v8a`와 `armeabi-v7a` 아키텍처를 모두 빌드하려고 시도합니다. 그러나 Vulkan SDK C++ 래퍼(`vulkan.hpp`)는 32비트 환경에서 `VkBuffer`를 포인터가 아닌 `uint64_t`로 처리하면서 `std::ostream`의 `operator<<` 오버로딩 및 내부 타입 변환이 깨지는 업스트림 이슈가 존재합니다. 이로 인해 32비트 컴파일 시 수많은 에러가 발생했습니다.

## Decision
위 문제들을 해결하기 위해 다음과 같이 네이티브 빌드 설정을 확정합니다.

1. **Vulkan 1.1 지원을 위한 C++ 타겟 API 분리:**
   - 모듈의 `build.gradle`에서 `minSdkVersion 28`을 선언하면 Expo 루트 앱(24)과 충돌하여 Manifest Merger 에러가 발생합니다.
   - 따라서 `minSdkVersion`은 명시하지 않고(루트의 24를 상속), CMake 컴파일러에게만 API 28을 사용하도록 지시합니다.
   - **결정사항:** `CMakeLists.txt`로 전달되는 arguments에 `-DANDROID_PLATFORM=28`을 명시하여 C++ 컴파일 및 링킹 시에만 API 28의 NDK 라이브러리를 참조하도록 구성합니다.

2. **빌드 아키텍처를 64비트로 제한 (`arm64-v8a`):**
   - 타겟 디바이스(Galaxy S26) 및 최신 안드로이드 기기들은 모두 64비트 환경을 사용합니다.
   - 불필요하고 컴파일이 실패하는 32비트(`armeabi-v7a`) 빌드를 완전히 제외시킵니다.
   - **결정사항:** 모듈의 `build.gradle`에 `ndk { abiFilters 'arm64-v8a' }`를 명시하여 64비트 아키텍처만 컴파일하도록 제한합니다.

## Temporary SPIRV-Headers Workaround

Windows 호스트에서 LunarG Vulkan SDK를 사용하여 Android NDK 대상으로 크로스 컴파일하면,
`SPIRV-HeadersConfig.cmake`가 Vulkan SDK에 설치되어 있어도 `ggml-vulkan`의
`find_package(SPIRV-Headers CONFIG REQUIRED)`가 이를 찾지 못합니다. Gradle 빌드 캐시를
비활성화한 상태에서도 동일하게 재현되므로 캐시 문제가 아닙니다.

현재 PoC는 빌드를 유지하기 위해 다음 업스트림 파일에 임시 `FetchContent` fallback을
적용합니다.

`stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt`

- 기본 `find_package`를 먼저 시도합니다.
- 패키지를 찾지 못한 경우에만 KhronosGroup/SPIRV-Headers를 가져옵니다.
- 이 변경은 서브모듈 내부의 로컬 수정이며 Pocket Canvas 루트 커밋만으로 보존되지 않습니다.
- 서브모듈 초기화 또는 업데이트 후 Vulkan 빌드가 다시 실패하면 이 workaround의 유실 여부를 확인해야 합니다.
- 네트워크 의존성과 `GIT_TAG main`의 비결정성 때문에 영구 해결책으로 채택하지 않습니다.

후속 작업에서는 Windows + Android NDK 크로스컴파일 최소 재현을 만들고, 호스트 Vulkan
SDK의 SPIRV-Headers 패키지를 명시적으로 탐색하는 수정안을 업스트림에 제안합니다. 업스트림
수정이 반영되면 이 fallback을 제거하고 서브모듈을 clean 상태로 되돌립니다.

## Consequences
- **장점:** Expo 앱의 전역 `minSdkVersion`을 28로 억지로 올리지 않아도 되므로, 안드로이드 Manifest 시스템과의 충돌 없이 최신 Vulkan 기능을 C++ 레이어에서 안전하게 사용할 수 있습니다.
- **장점:** 32비트 빌드를 제외함으로써 C++ 코어(`stable-diffusion.cpp`)의 빌드 시간이 절반 이상 단축됩니다.
- **제한사항:** 이 앱은 32비트 안드로이드 기기(구형 기기)에서는 네이티브 라이브러리가 로드되지 않아 실행할 수 없습니다. (프로젝트의 목적상 최신 기기 타겟이므로 수용 가능함)
