# Docker Android release build

Pocket Canvas를 Docker Desktop의 Linux 컨테이너에서 빌드해 개인 Android 기기 테스트용 release APK를 만든다.

빌드 환경과 병렬도 결정의 근거는 [ADR-019](decisions/ADR-019-docker-android-release-build.md), 오류별 복구 절차는 [Troubleshooting](troubleshooting.md)을 참조한다.

## Build with Git Bash

Docker Desktop을 Linux containers 모드로 실행하고 저장소 루트의 Git Bash에서 실행한다.

```bash
./scripts/build-release-apk.sh
```

실행 권한 문제로 시작되지 않으면 다음처럼 명시적으로 Bash를 사용한다.

```bash
bash ./scripts/build-release-apk.sh
```

출력 디렉터리를 바꾸려면 첫 번째 인자로 지정한다.

```bash
./scripts/build-release-apk.sh artifacts/android
```

결과는 기본적으로 다음 경로에 생성된다.

```text
artifacts/android/pocket-canvas-release.apk
```

최초 실행은 전체 도구체인과 의존성을 준비하므로 오래 걸리고 디스크 공간을 많이 사용한다. 이후 실행은 Docker BuildKit cache를 재사용한다.

## Install on a connected device

USB 디버깅을 활성화하고 기기를 연결한 뒤 Git Bash에서 설치한다.

```bash
adb install -r ./artifacts/android/pocket-canvas-release.apk
```

기존 앱의 서명이 다르면 Android가 업데이트를 거절할 수 있다. 기존 앱 데이터를 보존할 필요가 없을 때만 기기에서 기존 앱을 제거하고 다시 설치한다.

## Toolchain

- Node.js 22
- JDK 17
- Android SDK / target / compile API 36
- Android Build Tools 36.0.0과 Expo/RN 작업 호환용 35.0.0
- Android NDK 27.1.12297006
- CMake 3.22.1
- Vulkan-Headers 1.4.350.0, GLSL compiler와 SPIR-V headers
- arm64-v8a only

앱과 로컬 `stable-diffusion` 모듈은 루트 프로젝트와 동일한 NDK 버전을 사용한다.

## Signing limitation

현재 release APK는 Android 프로젝트 설정에 따라 debug keystore로 서명한다. 개인 기기에서 release 변형의 성능과 동작을 시험하기 위한 APK이며 Play Store 배포용 artifact가 아니다. 배포할 때는 별도의 안전한 release keystore와 외부 secret 주입 방식을 구성해야 한다.

PowerShell 환경이 필요한 경우 기존 `scripts/build-release-apk.ps1`도 동일한 APK를 생성한다.
