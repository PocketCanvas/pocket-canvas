# Pocket Canvas — Agent Instructions
1. 코드를 작성하거나 아키텍처를 변경하기 전에 반드시 숙지
2. 한국어로 답변

## Boundaries
- `stable-diffusion/cpp/stable-diffusion.cpp/` 내부의 코드는 절대 수정하지 않는다
- 커스텀 네이티브 로직은 `StableDiffusionBridge.cpp`에서만 작성
- `stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt` 에는 Android SPIRV-Headers 우회를 위한 의도적인 local modification이 존재, 이를 revert/reset하지 않는다. → ADR-002
- `stable-diffusion/android/build.gradle`에 `minSdkVersion`을 직접 선언하지 않는다. Android API 28은 CMake `ANDROID_PLATFORM`으로 설정
- 루트와 `stable-diffusion/`의 Expo / React / React Native 버전을 서로 다른 호환 세대로 변경하지 않는다
- `npm audit fix --force`를 사용하지 않는다
- `stable-diffusion/src/` 변경 후에는 반드시 `cd stable-diffusion && npm run build`를 실행

## 명령어

| 목적 | 명령어 |
|---|---|
| 앱 실행 (Android) | `npx expo run:android` |
| Expo 호환성 검사 | `npx expo install --check` |
| 프로젝트 진단 | `npx expo-doctor` |
| 타입 검사 | `npx tsc --noEmit` |
| 앱 린트 | `npm run lint` |
| 코드 포맷 | `npm run format` |
| 코드 포맷 검사 | `npm run format:check` |
| TS 모듈 빌드 | `cd stable-diffusion && npm run build` |
| 모듈 의존성 설치 | `cd stable-diffusion && npm install` | 클린 빌드 (Windows) | `cd android && .\gradlew.bat clean` |
| C++ 로그 모니터링 | `adb logcat -s StableDiffusionBridge:I *:S` |

## Context routing

| ADR | 제목 | 핵심 |
|---|---|---|
| ADR-001 | 네이티브 모듈 구조 | Expo Modules API + JNI + git submodule |
| ADR-002 | Vulkan NDK 빌드 | `ANDROID_PLATFORM=28`, `arm64-v8a` only |
| ADR-003 | SD 1.5 PoC 결과 | Q4_K + LCM-LoRA 기능 PoC 성공, 전체 116초 |
| ADR-004 | Expo 의존성 버전 정책 | SDK 57 호환 버전 및 루트–모듈 동기화 |
| ADR-005 | UI 구성과 테마 | React Native 중심 화면 구성 + 화면·컴포넌트 책임 분리 + 단일 `Colors` 팔레트 |
| ADR-006 | 앱 저장소와 모델 가져오기 | Expo 문서 저장소 + header 검증 + JSON 인덱스와 실패 롤백 |
| ADR-007 | 생성 계약과 결과 저장 | 커스텀 모델·LoRA·steps + 단계별 진행 이벤트 + 영구 PNG |
| ADR-008 | 히스토리 화면과 이미지 관리 | 3열 그리드, 2탭 필터, expo-sharing 이미지 공유, 모달 스크롤 분리, 고아 파일 자동 복구 |

## Known landmines
- `NativeMicrotasksCxx could not be found` → root/module React Native version mismatch 가능성이 높음. ADR-004 참조
- NDK 변경 후 native build가 이전 NDK를 참조할 수 있음. → ADR-002의 native cache reset 절차 참조
- `stable-diffusion.cpp` 및 Expo/RN upstream warning을 해결하기 위해 submodule이나 `node_modules`를 수정하지 않는다
- Android 빌드는 `arm64-v8a`만 지원
