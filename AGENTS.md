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
| 모듈 의존성 설치 | `cd stable-diffusion && npm install` |
| 클린 빌드 (Windows) | `cd android && .\gradlew.bat clean` |
| C++ 로그 모니터링 | `adb logcat -s StableDiffusionBridge:I '*:S'` |

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
| ADR-009 | 생성 병목 계측과 TAESD PoC | Vulkan 정상 확인, VAE decode 병목, TAESD는 빠르지만 최종 품질 부족 |
| ADR-010 | 생성 옵션과 내장 Hires 업스케일 | sampler+scheduler preset, 해상도·CFG·seed, 내장 hires 1.5×~4.0× |
| ADR-011 | 생성 요청 로그 정책 | 요청당 약 10줄: Vulkan·설정·단계별 wall time, upstream은 warning/error만 전달 |
| ADR-012 | 생성 메타데이터 완전성과 이미지 보존 | 정상 metadata 필수 계약 + missing 복구 variant + PNG 보존 우선 |
| ADR-013 | 전체 화면 갤러리와 확대 제스처 | filteredItems 페이징 + zoom-toolkit Gallery + Modal 전용 GestureHandlerRootView |

## Known landmines
- `NativeMicrotasksCxx could not be found` → root/module React Native version mismatch 가능성이 높음. ADR-004 참조
- NDK 변경 후 native build가 이전 NDK를 참조할 수 있음. → ADR-002의 native cache reset 절차 참조
- `stable-diffusion.cpp` 및 Expo/RN upstream warning을 해결하기 위해 submodule이나 `node_modules`를 수정하지 않는다
- Android 빌드는 `arm64-v8a`만 지원
- TAESD 실행 코드는 upstream에 있지만 가중치는 번들되지 않는다. 별도 SD 1.x TAESD 파일과 `taesdUri`가 필요하며, 기본 최종 decoder로 채택하지 않는다. → ADR-009
- 생성 로그는 `[request]`, `[settings]`, `[vulkan]`, `[stage]` 태그를 사용한다. 과거 ADR-009의 CPU/RSS 상세 계측 로그는 제거되었으며 필요할 때만 별도 계측 빌드로 복원한다. → ADR-011
- 23개 sampling preset과 8개 내장 Hires 방식은 네이티브 빌드까지 검증됐지만, 전체 조합의 실기기 생성 성공·품질·메모리는 아직 검증되지 않았다. → ADR-010
- 정상 생성 metadata에는 현행 옵션 전체를 필수로 기록한다. 기록 실패 PNG는 삭제하지 않고 `missing` 복구 항목으로 표시한다. → ADR-012
- 히스토리 뷰어의 좌우 넘김과 핀치 확대를 별도 `FlatList`/zoom wrapper로 분리하지 않는다. `react-native-zoom-toolkit`의 `Gallery`가 두 동작을 함께 소유한다. → ADR-013
- Android `Modal` 안의 Gallery는 모달 내부 `GestureHandlerRootView`가 필수다. 앱 루트 wrapper만 믿고 제거하면 좌우 넘김과 핀치가 모두 무반응이 될 수 있다. → ADR-013
- `react-native-zoom-toolkit` 업데이트 후에는 Android 실기기에서 좌우 넘김, 핀치 확대, 확대 후 이동과 페이지 경계 handoff를 검증한다. lockfile을 삭제하지 않고 `npm install`로 manifest와 lockfile을 함께 갱신한다. → ADR-013
