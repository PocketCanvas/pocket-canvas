# Troubleshooting

반복적으로 확인된 문제와 해결 절차를 기록

## Docker release APK 빌드

기본 실행은 저장소 루트의 Git Bash에서 다음과 같다.

```bash
./scripts/build-release-apk.sh
```

결과 파일은 `artifacts/android/pocket-canvas-release.apk`이다. 전체 도구 선택의 근거는 ADR-019를 참조한다.

### 모듈이 NDK `27.0.12077973`을 추가로 설치하거나 선택함

- **증상:** 루트 설정에는 NDK `27.1.12297006`이 표시되지만 `stable-diffusion` 구성에서 27.0을 요청하거나 해당 경로를 참조
- **원인:** Expo 모듈의 Android plugin 기본 NDK 선택이 루트 앱과 달라질 수 있음
- **해결:** `stable-diffusion/android/build.gradle`의 `android` 블록에서 `ndkVersion rootProject.ext.ndkVersion`을 유지. 모듈에 `minSdkVersion`을 추가하는 해결책과 혼동하지 않음
- **검증:** 로그의 ExpoRootProject NDK가 `27.1.12297006`이고 native compile target이 `aarch64-none-linux-android28`인지 확인

### host Vulkan shader generator 구성 실패

ggml Vulkan 빌드는 Android cross compile과 별도로 Linux host executable을 먼저 만든다. 아래 오류는 submodule 소스 문제가 아니라 컨테이너 host 도구 누락 또는 버전 불일치다.

- `Ninja not found`: 컨테이너에 host `ninja-build` 필요
- `spirv/unified1/spirv.hpp` 없음: SPIR-V headers가 `$VULKAN_SDK/Include/spirv`에서 보여야 함
- `vk::LayerSettingEXT` 없음: Vulkan-Headers가 너무 오래됨. 검증된 Khronos `vulkan-sdk-1.4.350.0` tag 사용
- `vk_video/vulkan_video_codec_av1std.h` 없음: Vulkan-Headers의 `include/vulkan`뿐 아니라 `include/vk_video`도 함께 설치

**대응:** `Dockerfile.android`의 Vulkan/Ninja 설치를 유지한다. 이 문제를 고치기 위해 `stable-diffusion.cpp` submodule 또는 의도적으로 수정된 ggml-vulkan CMake를 변경하지 않는다.

### Docker BuildKit가 `rpc error: code = Unavailable ... EOF`로 종료

- **증상:** Gradle의 명시적인 실패 없이 `failed to receive status`, `error reading from server: EOF`가 출력되고 Docker Desktop 엔진 연결이 끊김
- **원인:** Gradle worker와 여러 CMake/Ninja compile이 겹친 peak memory로 Docker Desktop 엔진이 중단될 수 있음
- **확인:** `docker info`가 실패하면 Docker Desktop 엔진이 재기동될 때까지 기다림. `docker info`가 성공하면 캐시를 이용해 다시 실행
- **해결:** Dockerfile의 `--max-workers=2`, `--no-parallel`, `CMAKE_BUILD_PARALLEL_LEVEL=2`를 제거하지 않음. 계속 발생하면 Docker Desktop의 메모리 할당과 호스트 여유 메모리를 확인
- **주의:** 같은 지점의 EOF를 C++ 컴파일 오류로 간주해 upstream을 수정하지 않음

### npm audit 경고

- 빌드 중 루트와 모듈 의존성의 취약점 요약이 출력될 수 있으나 그 자체는 빌드 실패가 아님
- `npm audit fix --force`를 실행하지 않음. Expo/RN 호환 세대를 깨뜨릴 수 있으므로 별도 의존성 검토 작업으로 처리

### APK 생성 후 확인

```bash
sha256sum ./artifacts/android/pocket-canvas-release.apk
adb install -r ./artifacts/android/pocket-canvas-release.apk
```

- APK에는 `lib/arm64-v8a/libstable_diffusion_bridge.so`가 있어야 하고 다른 ABI 디렉터리는 없어야 함
- 현재 release 변형은 debug keystore로 서명된다. 기존 설치 앱과 인증서가 다르면 `adb install -r` 업데이트가 거절될 수 있음
- Play Store 배포 artifact로 사용하지 않음

## 터보모듈 크래시: `NativeMicrotasksCxx could not be found`
- **원인:** 루트와 로컬 모듈 간 `react-native` 버전 불일치
- **해결:** 두 `package.json`의 Expo/React/React Native 버전을 일치시키고, `stable-diffusion/`과 루트에서 각각 `npm install` 후 `npx expo install --check` 실행

## lockfile 버전 불일치
- **원인:** 루트 설치만 실행하면 독립된 `stable-diffusion/package-lock.json`은 갱신되지 않음
- **해결:** 모듈 manifest 변경 시 `cd stable-diffusion && npm install`을 먼저 실행하고 루트에서 `npm install` 실행

## TS 모듈 변경 미반영
- **원인:** 앱은 `stable-diffusion/build/index.js`를 참조 (TS 원본이 아님)
- **해결:** `cd stable-diffusion && npm run build` 실행

## Manifest Merger 에러: `minSdkVersion 24 < 28`
- **원인:** 모듈에서 `minSdkVersion 28`을 직접 선언하면 루트(24)와 충돌
- **해결:** 모듈에서 `minSdkVersion` 제거, CMake에 `-DANDROID_PLATFORM=28`만 사용

## stale NDK/CMake 캐시
- **증상:** Expo/RN은 NDK `27.1.12297006`을 선택하지만 `stable-diffusion/android/.cxx/**/compile_commands.json`은 이전 NDK `27.0.12077973`의 `clang++`을 참조
- **원인:** SDK/NDK 변경 전 생성된 외부 네이티브 빌드 모델을 AGP가 재사용
- **해결:** `cd android && .\gradlew.bat clean` 실행 후 재빌드. RN codegen 디렉터리 삭제 순서 때문에 app clean이 실패하면, 경로가 프로젝트 내부인지 확인한 뒤 `stable-diffusion/android/.cxx`와 `android/app/.cxx`만 삭제
- **검증:** 새 `stable-diffusion/android/.cxx/**/compile_commands.json`의 NDK 경로가 `27.1.12297006`이고 target이 `aarch64-none-linux-android28`인지 확인

## 업스트림 컴파일 경고
- `wstring_convert` deprecated 및 missing `override`는 `stable-diffusion.cpp` 업스트림 C++ 경고이며 현재 빌드 실패나 ABI 불일치가 아님
- Expo Kotlin deprecated API 및 Gradle 10 호환성 경고는 Expo/RN/서드파티 플러그인에서 발생함
- **대응:** 서브모듈이나 `node_modules`를 로컬 수정하거나 경고를 숨기지 말고, Expo/RN 및 업스트림 업데이트로 해결

## 32비트 빌드 에러: `vk::Buffer` 관련 C++ 템플릿 에러
- **원인:** `vulkan.hpp`가 32비트에서 핸들을 `uint64_t`로 처리 → 타입 호환성 깨짐
- **해결:** `ndk { abiFilters 'arm64-v8a' }` — 64비트 전용

## 16KB 페이지 사이즈 경고
- **증상:** Android 15+ 기기에서 ELF 정렬 경고 (`libreanimated.so` 등)
- **대응:** RN 생태계 과도기 현상. 기능에 영향 없음. Expo/RN 및 관련 dependency 업데이트 시 재확인

## 히스토리 전체 화면 뷰어에서 좌우 넘김과 핀치가 모두 무반응
- **원인:** Android `Modal`은 앱 루트와 별도 네이티브 뷰 계층을 사용하므로, 앱 최상위의 `GestureHandlerRootView`가 모달 내부까지 적용되지 않음
- **해결:** `HistoryImageViewer`의 `Modal` 바로 안쪽 전체를 `GestureHandlerRootView style={{ flex: 1 }}`로 감쌈
- **주의:** 페이지 이동과 확대를 별도 `FlatList`와 zoom wrapper로 다시 분리하지 않음. `react-native-zoom-toolkit`의 `Gallery`가 두 제스처를 함께 소유해야 함
- **검증:** 1× 좌우 넘김, 두 손가락 핀치, 확대 후 이미지 이동, 이미지 경계에서 다음 페이지로 handoff, 상세 시트가 열린 동안의 입력을 Android 실기기에서 확인 → ADR-013

## 생성·양자화 중 처음 연 히스토리가 로딩 화면에 멈춤
- **증상:** 앱 실행 후 히스토리를 한 번도 열지 않은 상태에서 생성 또는 양자화를 시작하고 히스토리 탭으로 이동하면 로딩 화면이 작업 종료까지 유지됨
- **원인:** 장시간 JNI 호출이 Expo Modules의 단일 기본 `AsyncFunctionQueue`를 점유해, 히스토리 최초 로드에 필요한 Expo FileSystem `File.text()`가 실행 대기함
- **오해하기 쉬운 점:** 히스토리를 미리 열었을 때 즐겨찾기는 optimistic update로 즉시 바뀌므로 저장까지 완료된 것처럼 보일 수 있음. 실제 Promise는 공용 큐가 막혀 있으면 대기함
- **해결:** `StableDiffusionModule.kt`의 `quantizeModel`과 `generateImage` `AsyncFunction` 모두 `.runOnQueue(nativeOperationQueue)`로 별도 coroutine scope를 사용함. JSON 읽기를 동기식으로 우회하는 방식으로 대체하지 않음
- **검증:** 앱 시작 → 히스토리 미진입 → 생성/양자화 시작 → 작업 중 히스토리 최초 진입 → 목록·뷰어·즐겨찾기·공유 확인. `cd android && .\gradlew.bat :stable-diffusion:assembleDebug`도 실행 → ADR-015
