# Pocket Canvas — AI 에이전트 지침 (AGENTS.md)

> 코드를 작성하거나 아키텍처를 변경하기 전에 반드시 숙지하세요.

## 프로젝트 개요
안드로이드 기기에서 **C++ 코어(stable-diffusion.cpp)**를 활용하여 Stable Diffusion 모델을 온디바이스로 구동하는 앱입니다.
- **프레임워크:** Expo 57.0.13 + React Native 0.86.2 + React 19.2.3 (New Architecture)
- **네이티브:** Kotlin(Expo Modules) → JNI → C++(stable-diffusion.cpp, git submodule)
- **GPU:** Vulkan 1.1, 모델 로딩: mmap
- **아키텍처 상세:** [docs/architecture.md](docs/architecture.md) 참조

## 핵심 원칙

1. **서브모듈 수정 금지.** `stable-diffusion/cpp/stable-diffusion.cpp/` 내부의 코드는 절대 수정하지 않습니다. 커스텀 로직은 `StableDiffusionBridge.cpp`에서만 작성하세요.
2. **점진적 검증 (Step-by-Step PoC).** 복잡한 구조를 한 번에 설계하지 마세요. 작은 단위로 빌드하고, 빌드가 성공하는지 확인한 뒤 다음 단계로 넘어가세요.
3. **소스 주도 개발.** Expo SDK 57 / React Native 0.86.2의 최신 아키텍처를 사용 중입니다. 구형 지식에 의존하지 말고, 반드시 [공식 문서](https://docs.expo.dev/versions/v57.0.0/)를 확인하세요.
4. **성능 최우선.** 메모리, 배터리, 빌드 속도를 항상 고려하세요.
5. **의존성 버전 동기화.** 루트 앱과 `stable-diffusion/` 모듈의 Expo, React, React Native, TypeScript 버전을 같은 SDK 57 호환 세대로 유지하세요. 버전 변경 후 두 lockfile을 모두 갱신하세요.
6. **UI와 테마 경계.** 화면 배치와 커스텀 상호작용은 React Native로 구현하고, 네이티브 컨트롤이 유리한 곳만 Expo UI를 사용하세요. 색상은 `src/constants/theme.ts`의 `Colors.light`와 `Colors.dark`에서만 정의하며 두 팔레트의 토큰 키를 동일하게 유지하세요.
7. **린트와 포맷 분리.** ESLint(`expo lint`)는 코드 오류와 규칙 위반을 검사하고 Prettier는 코드 모양만 통일합니다. 경고를 숨기기 위해 ESLint/Reanimated strict 설정을 끄지 말고 원인을 수정하세요.

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
| 모델 전송 | `adb push <model>.safetensors /data/user/0/com.anonymous.pocketcanvas/files/` |
| C++ 로그 모니터링 | `adb logcat -s StableDiffusionBridge:I *:S` |

## 아키텍처 결정 기록 (ADRs)

상세 내용은 각 문서를 참조하세요:

| ADR | 제목 | 핵심 |
|---|---|---|
| [ADR-001](docs/decisions/ADR-001-native-module-architecture.md) | 네이티브 모듈 구조 | Expo Modules API + JNI + git submodule |
| [ADR-002](docs/decisions/ADR-002-vulkan-ndk-build.md) | Vulkan NDK 빌드 | `ANDROID_PLATFORM=28`, `arm64-v8a` only |
| [ADR-003](docs/decisions/ADR-003-poc-benchmark-results.md) | SD 1.5 PoC 결과 | Q4_K + LCM-LoRA 기능 PoC 성공, 전체 116초 |
| [ADR-004](docs/decisions/ADR-004-expo-dependency-version-policy.md) | Expo 의존성 버전 정책 | SDK 57 호환 버전 및 루트–모듈 동기화 |
| [ADR-005](docs/decisions/ADR-005-ui-composition-and-theme.md) | UI 구성과 테마 | React Native 중심 화면 구성 + 화면·컴포넌트 책임 분리 + 단일 `Colors` 팔레트 |
| [ADR-006](docs/decisions/ADR-006-app-storage-and-model-import.md) | 앱 저장소와 모델 가져오기 | Expo 문서 저장소 + header 검증 + JSON 인덱스와 실패 롤백 |
| [ADR-007](docs/decisions/ADR-007-generation-contract-progress-and-image-storage.md) | 생성 계약과 결과 저장 | 커스텀 모델·LoRA·steps + 단계별 진행 이벤트 + 영구 PNG |
| [ADR-008](docs/decisions/ADR-008-history-ui-and-image-management.md) | 히스토리 화면과 이미지 관리 | 3열 그리드, 2탭 필터, expo-sharing 이미지 공유, 모달 스크롤 분리, 고아 파일 자동 복구 |

## 절대 하지 말 것 (Boundaries)

- ❌ `stable-diffusion.cpp` 서브모듈 내부 코드 수정
- ❌ 모듈의 `build.gradle`에 `minSdkVersion` 직접 선언 (루트 상속, CMake 인자로만 처리)
- ❌ `react-native` 버전을 루트와 모듈 간 불일치시키기
- ❌ `npm audit fix --force`로 Expo 공식 호환 범위를 벗어나는 버전 적용
- ❌ `stable-diffusion/src/` TS 수정 후 `npm run build` 없이 테스트

### ⚠️ 임시 서브모듈 수정 예외
Android Vulkan 크로스컴파일 시 SPIRV-Headers 탐색 오류를 우회하기 위해 다음 업스트림 파일에 로컬 수정이 적용되어 있습니다.

`stable-diffusion/cpp/stable-diffusion.cpp/ggml/src/ggml-vulkan/CMakeLists.txt` 이 변경은 의도된 dirty 상태입니다. 임의로 원복하거나 서브모듈을 초기화하지 마세요. 자세한 배경과 제거 조건은 `ADR-002` 를 참조하세요.

## 알려진 이슈 (Gotchas)

### 🚨 터보모듈 크래시: `NativeMicrotasksCxx could not be found`
- **원인:** 루트와 로컬 모듈 간 `react-native` 버전 불일치
- **해결:** 두 `package.json`의 Expo/React/React Native 버전을 일치시키고, `stable-diffusion/`과 루트에서 각각 `npm install` 후 `npx expo install --check` 실행

### 📦 lockfile 버전 불일치
- **원인:** 루트 설치만 실행하면 독립된 `stable-diffusion/package-lock.json`은 갱신되지 않음
- **해결:** 모듈 manifest 변경 시 `cd stable-diffusion && npm install`을 먼저 실행하고 루트에서 `npm install` 실행

### 🔄 TS 모듈 변경 미반영
- **원인:** 앱은 `stable-diffusion/build/index.js`를 참조 (TS 원본이 아님)
- **해결:** `cd stable-diffusion && npm run build` 실행

### 🎨 생성 UI와 네이티브 추론 연결 범위
- 생성 화면은 모델, LoRA 0개 이상과 각 가중치·순서, 프롬프트, 추론 스텝, 출력 URI를 TS → Kotlin → JNI → C++로 전달함
- 진행 UI는 `Loading → Encoding → Steps → Decoding` 순서임. loading은 tensor 전체 개수가 있을 때만 실제 `%`, sampling은 `N/M`을 표시하고 encoding·decoding에는 가짜 퍼센트를 만들지 말 것
- `stable-diffusion.cpp` progress callback은 모델 로딩과 sampling에 함께 사용됨. 브리지의 현재 단계와 `get_learned_condition completed` 경계를 무시하고 callback 숫자를 전부 sampling steps로 취급하지 말 것
- 결과는 `Paths.document/images/YYYYMMDD-HHMMSS-<id>.png`에 저장하고 `images/meta.json`에 생성 설정을 기록함. 메타데이터 기록 실패 시에도 PNG는 보존할 것
- 모델·LoRA 선택기의 자동 분류는 기본 필터일 뿐이며 `전체 보기`에서는 모든 가져온 파일을 선택할 수 있음
- 현재 해상도 512×512, LCM sampler/scheduler, CFG 1.0과 생성별 context 생성·해제는 PoC 설정으로 고정되어 있음. 임의로 UI 상태를 추가하지 말고 전체 네이티브 계약을 함께 확장할 것
- 테마 전환 UI는 아직 없음. 생성 화면은 `Colors.dark`를 명시적으로 사용하며 `Colors.light`는 전환 구현을 위한 준비 상태

### 🗂️ 모델 관리 UI 구현 범위

- `src/app/models.tsx`는 화면 상태와 이벤트 조정을 담당하고, 카드·상세 모달·관련 타입은 `src/components/model-management.tsx`에 둠
- 파일 선택·복사·`models.json` 영속화와 삭제는 `src/lib/model-files.ts`, GGUF/SafeTensors header 및 tensor signature 판별은 `src/lib/model-file-inspection.ts`가 담당함
- 모델은 Expo `Paths.document/models/`에 저장하며 저장 구조와 실패 복구 규칙은 `docs/architecture.md`의 앱 저장소 절 및 `ADR-006`을 따름
- 모델/LoRA 선택과 LoRA 가중치 설정은 생성 화면의 책임이며 모델 관리 화면에 추가하지 말 것

### 🖼️ 히스토리 UI 및 이미지 관리 범위

- `src/app/history.tsx`는 화면 상태와 이벤트 조정을 담당하고, 3열 그리드 카드·상세 모달은 `src/components/history-management.tsx`에 둠
- 탭은 '전체'와 '즐겨찾기' 2개이며, 카드 우상단 하트 오버레이를 통해 즉각적인 즐겨찾기 토글 및 `meta.json` 영속화를 수행함
- 이미지 공유는 `expo-sharing`을 사용하여 실제 PNG 파일 바이너리를 네이티브 시스템 공유 시트로 전달함
- 상세 바텀시트 모달은 배경 터치 닫기와 내부 `ScrollView` 스크롤 제스처를 분리하여 하단 삭제 버튼까지 스크롤이 차단되지 않도록 함
- `src/lib/image-files.ts`는 `meta.json`과 `Paths.document/images/` 디렉토리 스캔을 병행하여 고아 PNG 파일도 타임스탬프로 자동 복구함 (ADR-008)

### 🛠️ Manifest Merger 에러: `minSdkVersion 24 < 28`
- **원인:** 모듈에서 `minSdkVersion 28`을 직접 선언하면 루트(24)와 충돌
- **해결:** 모듈에서 `minSdkVersion` 제거, CMake에 `-DANDROID_PLATFORM=28`만 사용

### 🧹 stale NDK/CMake 캐시
- **증상:** Expo/RN은 NDK `27.1.12297006`을 선택하지만 `stable-diffusion/android/.cxx/**/compile_commands.json`은 이전 NDK `27.0.12077973`의 `clang++`을 참조
- **원인:** SDK/NDK 변경 전 생성된 외부 네이티브 빌드 모델을 AGP가 재사용
- **해결:** `cd android && .\gradlew.bat clean` 실행 후 재빌드. RN codegen 디렉터리 삭제 순서 때문에 app clean이 실패하면, 경로가 프로젝트 내부인지 확인한 뒤 `stable-diffusion/android/.cxx`와 `android/app/.cxx`만 삭제
- **검증:** 새 `stable-diffusion/android/.cxx/**/compile_commands.json`의 NDK 경로가 `27.1.12297006`이고 target이 `aarch64-none-linux-android28`인지 확인

### ⚠️ 업스트림 컴파일 경고
- `wstring_convert` deprecated 및 missing `override`는 `stable-diffusion.cpp` 업스트림 C++ 경고이며 현재 빌드 실패나 ABI 불일치가 아님
- Expo Kotlin deprecated API 및 Gradle 10 호환성 경고는 Expo/RN/서드파티 플러그인에서 발생함
- **대응:** 서브모듈이나 `node_modules`를 로컬 수정하거나 경고를 숨기지 말고, Expo/RN 및 업스트림 업데이트로 해결

### 💥 32비트 빌드 에러: `vk::Buffer` 관련 C++ 템플릿 에러
- **원인:** `vulkan.hpp`가 32비트에서 핸들을 `uint64_t`로 처리 → 타입 호환성 깨짐
- **해결:** `ndk { abiFilters 'arm64-v8a' }` — 64비트 전용

### ⚠️ 16KB 페이지 사이즈 경고
- **증상:** Android 15+ 기기에서 ELF 정렬 경고 (`libreanimated.so` 등)
- **대응:** RN 생태계 과도기 현상. 기능에 영향 없음. **무시할 것.**
