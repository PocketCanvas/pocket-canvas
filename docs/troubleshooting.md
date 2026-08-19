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