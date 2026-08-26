# Pocket Canvas — Agent Instructions
1. 코드를 작성하거나 아키텍처를 변경하기 전에 반드시 숙지
2. 한국어로 답변

## Boundaries
- `stable-diffusion/cpp/stable-diffusion.cpp/` 내부의 코드는 절대 수정하지 않는다
- 추론·양자화 등 커스텀 네이티브 연산 로직은 `StableDiffusionBridge.cpp`에서만 작성한다. Kotlin 모듈은 API 계약 검증, lifecycle, 이벤트 전달, 실행 큐 지정만 담당한다
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
| 앱 단위 테스트 | `npm run test:model-files` |
| 코드 포맷 | `npm run format` |
| 코드 포맷 검사 | `npm run format:check` |
| TS 모듈 빌드 | `cd stable-diffusion && npm run build` |
| Android 모듈 빌드 | `cd android && .\gradlew.bat :stable-diffusion:assembleDebug` |
| Docker 릴리즈 APK (Git Bash) | `./scripts/build-release-apk.sh` |
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
| ADR-014 | Android 온디바이스 스트리밍 양자화 | 클릭 시 tensor 저장 타입 검사 + 검증된 6개 타입 + 임시 GGUF 롤백 + 생성·양자화 직렬화 |
| ADR-015 | 무거운 작업 전역 조정 | Zustand 즉시 거절 + JSON commit 큐 + native mutex + Expo 공용 큐 분리 |
| ADR-016 | 생성 화면 상태 모델 | draft/run reducer 분리 + 명시적 실행 상태 전이 + 모델 카탈로그 재조정 |
| ADR-017 | 검증 근거 기반 VAE 메모리 정책 | SDXL Turbo Q4 768²에만 48×48 tiling 자동 적용 + header 기반 보수적 판정 |
| ADR-018 | 모델 기술자 기반 지능형 메모리 정책 | header 근거와 workload로 verified/conservative/default 정책을 C++ bridge에서 합성 |
| ADR-019 | Docker 기반 Android 릴리즈 빌드 | 고정 Android/Vulkan 도구체인 + Git Bash 진입점 + 제한된 병렬도 |

## Known landmines
- Docker 릴리즈 빌드의 기준 진입점은 Git Bash의 `./scripts/build-release-apk.sh`이며 결과는 `artifacts/android/pocket-canvas-release.apk`이다. host Vulkan generator에는 Ninja, SPIR-V headers, Vulkan `vulkan/`과 `vk_video/`가 모두 필요하다. → ADR-019, `docs/troubleshooting.md`
- Docker BuildKit가 Gradle 오류 없이 `rpc error: code = Unavailable ... EOF`로 종료되면 엔진 중단 또는 peak memory를 먼저 의심한다. `--max-workers=2`, `--no-parallel`, `CMAKE_BUILD_PARALLEL_LEVEL=2`를 제거하지 않는다. → ADR-019
- `stable-diffusion/android/build.gradle`의 `ndkVersion rootProject.ext.ndkVersion`은 루트와 Expo 모듈이 NDK 27.1을 공유하기 위한 설정이다. 이를 제거하거나 별도 NDK 버전으로 바꾸지 않는다. `minSdkVersion` 금지 규칙과는 별개다. → ADR-002, ADR-019
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
- 양자화 입력 자체는 mmap이 아니라 upstream tensor 스트리밍을 사용한다. 결과 GGUF만 기존 mmap 추론 경로에서 사용한다. 진행률은 upstream callback의 완료 tensor 수를 표시하며 시간·byte 기준으로 합성하지 않고, 취소도 합성하지 않는다. → ADR-014
- 사용자가 수동 분류한 파일을 지원하기 위해 `MODEL` 항목의 양자화 버튼을 자동 감지 결과나 파일명·확장자·용량만으로 숨기지 않는다. 버튼 클릭 시 SafeTensors dtype 또는 GGUF tensor type을 header에서 검사하고, 실제 `quantizeStoredModel` 진입점에서도 다시 검사한다. 이미 양자화된 GGUF와 알 수 없는 저장 타입은 실행하지 않는다. → ADR-014
- 생성·양자화 JNI 호출을 기본 Expo Modules `AsyncFunctionQueue`에서 실행하지 않는다. 수분 동안 공용 큐를 점유하면 히스토리 최초 로드의 FileSystem 호출과 Sharing 등 독립 기능까지 대기한다. 두 호출 모두 `nativeOperationQueue`를 명시해야 한다. → ADR-015
- 무거운 작업은 JS에서 FIFO로 예약하지 않고 충돌 시 즉시 거절한다. `models.json`과 `images/meta.json` 큐에는 긴 파일 복사·생성·양자화가 아니라 전체 read-modify-write commit 구간만 넣는다. → ADR-015
- 생성 화면의 입력 중 설정은 `generationDraftReducer`, 실행 lifecycle은 `generationRunReducer`가 소유한다. 관련 상태를 개별 `useState`로 다시 분산하거나 draft와 run 상태를 하나의 reducer로 합치지 않는다. → ADR-016
- 모델 카탈로그가 다시 로드되면 선택된 model·TAESD·LoRA를 현재 레코드와 ID로 재조정한다. 삭제된 리소스를 stale 객체로 유지하지 않으며 LoRA weight는 유지한다. → ADR-016
- 생성 실패 중에는 직전 성공 이미지를 보존하고, PNG 생성 성공 후 metadata 기록만 실패한 경우는 생성 실패가 아니라 warning을 가진 성공 상태로 처리한다. → ADR-012, ADR-016
- VAE 48×48 tiling의 직접 검증 범위는 Galaxy S26의 SDXL Turbo Q4 + 768×768 + 내장 VAE다. 64×64를 기본값으로 올리지 않으며, 더 넓은 조합에 적용할 때는 검증 정책으로 가장하지 않고 `memory_source=conservative`로 기록한다. → ADR-017, ADR-018
- 메모리 정책 입력은 파일명 기반 모델 whitelist가 아니라 header에서 얻은 family·component별 storage/추정 byte와 별도 provenance를 가진 variant evidence다. `unknown`을 임의의 base 모델로 간주하지 않는다. 정책 합성·native 옵션 적용은 `StableDiffusionBridge.cpp`만 담당하며 사용자 설정 변경, 실패 후 fallback, 사전 거절을 추가하지 않는다. 적용 결과는 `[model]`과 `[settings]`의 `memory_source`, `memory_policy`, `diffusion_fa`, `params_backend`, `vae_tiling`로 확인한다. → ADR-018
