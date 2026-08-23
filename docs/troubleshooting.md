# Troubleshooting

반복적으로 확인된 문제와 해결 절차를 기록

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
