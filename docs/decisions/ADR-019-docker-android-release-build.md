# ADR-019: Docker 기반 Android 릴리즈 빌드

## Status

Accepted

## Date

2026-08-26

## Context

Pocket Canvas는 Expo/React Native뿐 아니라 JDK, Android SDK/NDK, CMake, Vulkan shader 도구와 대규모 C++ 컴파일을 함께 요구한다. 호스트마다 설치된 NDK와 Vulkan SDK가 다르면 디버그 빌드는 성공해도 릴리즈 빌드가 다른 도구를 선택할 수 있다. 개인 Android 기기에서 실제 release 변형을 반복 시험하려면 호스트 Android 개발 환경에 덜 의존하는 재현 가능한 진입점이 필요하다.

Docker Desktop Linux 빌드를 구성하는 과정에서 다음 제약을 확인했다.

- 루트 앱은 NDK `27.1.12297006`을 선택하지만 Expo 로컬 모듈은 명시하지 않으면 다른 기본 NDK를 요청할 수 있다.
- ggml Vulkan CMake는 Android용 코드를 교차 컴파일하기 전에 Linux host에서 shader generator를 빌드한다. 따라서 Android NDK 헤더만으로는 부족하고 host Ninja, Vulkan-Headers, SPIR-V headers와 `glslc`가 필요하다.
- Vulkan-Headers의 버전이 프로젝트의 host Vulkan SDK보다 오래되면 `vk::LayerSettingEXT` 같은 API가 없고, `vulkan/`만 복사하면 `vk_video/` include가 누락된다.
- Gradle과 여러 CMake/Ninja 작업을 동시에 실행하면 Docker Desktop 엔진이 빌드 오류 없이 `rpc error: code = Unavailable ... EOF`로 중단될 수 있다.
- 이 APK의 목적은 스토어 출시가 아니라 개인 기기에서 release 최적화와 네이티브 동작을 검증하는 것이다.

## Decision

저장소 루트의 `Dockerfile.android`를 Android release APK 빌드 환경의 기준으로 사용한다.

- Node 22 Bookworm 이미지는 digest로 고정한다.
- JDK 17, Android API 36, Build Tools 36.0.0과 35.0.0, NDK `27.1.12297006`, CMake 3.22.1을 설치한다.
- host Vulkan-Headers는 개발 호스트에서 검증된 SDK와 같은 `1.4.350.0`을 사용하고 `vulkan/`과 `vk_video/`를 함께 설치한다. SPIR-V headers, `glslc`, Ninja도 host 도구로 설치한다.
- 앱과 `stable-diffusion` 로컬 모듈이 같은 NDK를 사용하도록 모듈의 `android.ndkVersion`을 `rootProject.ext.ndkVersion`에 연결한다. `minSdkVersion`은 모듈 Gradle에 추가하지 않고 native target API 28은 기존 CMake 설정이 계속 소유한다.
- APK는 `arm64-v8a`만 빌드한다.
- Docker Desktop의 순간 메모리 사용량을 제한하기 위해 Gradle `--max-workers=2`, `--no-parallel`과 `CMAKE_BUILD_PARALLEL_LEVEL=2`를 적용한다.
- 기본 사용자 진입점은 Git Bash용 `scripts/build-release-apk.sh`로 한다. PowerShell 스크립트는 호환용으로 유지한다.
- BuildKit local output으로 `artifacts/android/pocket-canvas-release.apk`만 호스트에 내보내고 `artifacts/`는 Git에서 제외한다.
- 현재 APK는 기존 Android debug keystore로 서명한 release 변형이다. 개인 기기 시험에만 사용하고 배포용 keystore 결정과 secret 주입은 별도 작업으로 남긴다.

## Alternatives Considered

### 호스트 Android SDK로만 빌드

초기 실행은 빠르지만 설치된 SDK/NDK/Vulkan SDK와 stale native cache에 따라 결과가 달라진다. 빌드 환경 통일이라는 목적을 충족하지 않아 기본 경로로 채택하지 않았다.

### Expo EAS Build

원격 빌드와 서명 관리에는 적합하지만 현재의 로컬 submodule 수정, Vulkan host 도구와 대규모 native build를 먼저 별도 클라우드 환경에 맞춰야 한다. 개인 기기 반복 시험과 로컬 재현성이 우선이라 이번 결정에서 제외했다.

### 모든 Gradle/CMake 작업을 기본 병렬도로 실행

빌드가 빠를 수 있지만 Docker Desktop 엔진이 반복해서 EOF로 종료되었다. 안정적인 완료를 위해 제한된 병렬도를 선택했다.

### Vulkan 헤더를 Debian 패키지에만 의존

Bookworm의 Vulkan-Headers가 프로젝트에서 사용 중인 API보다 오래되어 host shader generator가 컴파일되지 않았다. 검증된 Khronos tag를 명시적으로 설치하는 방식을 선택했다.

## Consequences

- 개발자는 Docker Desktop과 Git Bash만으로 같은 Android native 도구 버전을 재사용할 수 있다.
- 최초 빌드는 SDK/NDK와 npm 의존성을 내려받고 C++를 컴파일하므로 오래 걸리고 디스크를 많이 사용한다. 이후 빌드는 BuildKit cache를 활용한다.
- 병렬도 제한으로 최대 처리량은 낮아지지만 Docker 엔진 중단 가능성과 peak memory를 줄인다.
- Debian apt repository와 Android SDK 다운로드 서버의 가용성에는 계속 의존한다. Node base image와 주요 Android/Vulkan 버전은 고정되어도 완전한 bit-for-bit 재현 빌드를 보장하지는 않는다.
- debug 인증서로 서명된 release APK는 Play Store에 배포할 수 없다.
- 상세 실행법은 `docs/docker-release-build.md`, 오류별 복구 절차는 `docs/troubleshooting.md`를 따른다.
