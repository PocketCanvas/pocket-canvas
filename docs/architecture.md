# Pocket Canvas — 아키텍처 개요

## 시스템 개요
Pocket Canvas는 안드로이드 기기에서 Stable Diffusion 모델을 온디바이스로 구동하는 앱입니다.

현재 JavaScript 런타임 기준 버전은 Expo 57.0.13, React Native 0.86.2, React 19.2.3입니다. 루트 앱과 로컬 Expo 모듈은 같은 버전 세대를 사용합니다.

```
┌─ React Native (Expo SDK 57) ─────────────────────┐
│  src/app/index.tsx                                │
│  └─ generateImage(prompt) 호출                     │
├───────────────────────────────────────────────────┤
│  stable-diffusion/src/index.ts                    │
│  └─ requireNativeModule('StableDiffusion')        │
├─ Kotlin (Expo Modules API) ───────────────────────┤
│  StableDiffusionModule.kt                         │
│  └─ System.loadLibrary("stable_diffusion_bridge") │
│  └─ AsyncFunction → JNI call (background thread)  │
├─ C++ (JNI Bridge) ────────────────────────────────┤
│  StableDiffusionBridge.cpp                        │
│  └─ new_sd_ctx(mmap=true, backend="vulkan")       │
│  └─ generate_image() → stbi_write_png()           │
├─ C++ Core (git submodule, 수정 금지) ──────────────┤
│  stable-diffusion.cpp                             │
│  └─ ggml + ggml-vulkan (GPU compute)              │
│  └─ mmap (메모리 매핑 모델 로드)                     │
└───────────────────────────────────────────────────┘
```

## 프로젝트 구조

```
pocket-canvas/
├── src/
│   ├── app/
│   │   ├── _layout.tsx          # 루트 레이아웃 (Theme + Tabs)
│   │   ├── index.tsx            # 생성 화면 상태와 네이티브 호출
│   │   ├── models.tsx           # 모델 탭 자리표시자
│   │   ├── history.tsx          # 히스토리 탭 자리표시자
│   │   └── settings.tsx         # 설정 탭 자리표시자
│   ├── components/              # 생성 컨트롤, 선택기, LoRA 정렬 목록, 공통 UI
│   ├── constants/theme.ts       # Colors, Spacing, Fonts 디자인 토큰
│   └── hooks/                   # useTheme, useColorScheme
│
├── stable-diffusion/            # Expo 로컬 네이티브 모듈
│   ├── src/
│   │   ├── index.ts             # JS 인터페이스 (generateImage, getSystemInfo)
│   │   └── StableDiffusionModule.ts  # requireNativeModule 바인딩
│   ├── cpp/
│   │   ├── StableDiffusionBridge.cpp  # JNI 브릿지 (커스텀 코드)
│   │   └── stable-diffusion.cpp/      # git submodule (수정 금지)
│   ├── android/
│   │   ├── build.gradle               # NDK 설정 (arm64-v8a, ANDROID_PLATFORM=28)
│   │   ├── CMakeLists.txt             # C++ 빌드 (Vulkan ON, glslc 경로)
│   │   └── src/.../StableDiffusionModule.kt  # Kotlin 브릿지
│   └── package.json             # main: "build/index.js"
│
├── android/                     # Expo prebuild/run 시 생성되는 앱 레벨 Android 설정 (gitignore)
├── docs/
│   ├── architecture.md          # 이 문서
│   └── decisions/               # ADR (Architecture Decision Records)
│       ├── ADR-001-native-module-architecture.md
│       ├── ADR-002-vulkan-ndk-build.md
│       ├── ADR-003-poc-benchmark-results.md
│       ├── ADR-004-expo-dependency-version-policy.md
│       └── ADR-005-ui-composition-and-theme.md
├── tasks/                       # 작업 계획 (spec, plan, todo)
├── AGENTS.md                    # AI 에이전트 지침 (최상위 규칙)
└── package.json                 # 루트 앱 의존성
```

## 데이터 플로우: 이미지 생성

1. 사용자가 프롬프트 입력 → Generate 버튼 클릭
2. `generateImage(prompt)` → Expo Modules 비동기 호출
3. Kotlin이 모델 경로(`filesDir`) + 출력 경로(`cacheDir`) 결정
4. JNI로 C++ 진입 → `new_sd_ctx(mmap=true, vulkan)` → 모델 로드
5. `generate_image()` → Vulkan GPU에서 디노이징 루프 실행
6. `stbi_write_png()` → 캐시 디렉토리에 PNG 저장
7. `"file://" + outputPath` → JS로 반환 → `<Image>` 컴포넌트에 렌더링

현재 생성 화면의 모델, LoRA, 가중치, 추론 스텝은 프런트엔드 상태와 상호작용만 구현되어 있습니다. 네이티브 모듈의 공개 계약은 아직 `generateImage(prompt)`이므로 이 값들은 추론 코어로 전달되지 않습니다.

## 생성 UI 구성

- `src/app/index.tsx`는 화면 상태와 생성 호출을 조정합니다.
- `generation-controls.tsx`는 하단 추론 스텝과 생성 버튼을, `generation-pickers.tsx`는 모델·LoRA 선택 모달을 담당합니다.
- `lora-sortable-list.tsx`는 Gesture Handler와 Reanimated로 멀티 LoRA 순서 변경을 구현합니다.
- 일반 배치, 텍스트, 카드, 모달은 React Native를 사용하고 슬라이더·버튼처럼 네이티브 동작이 유리한 부분만 Expo UI Jetpack Compose를 사용합니다.

## 테마 토큰

모든 앱 색상은 `src/constants/theme.ts`의 `Colors.light`와 `Colors.dark`에 정의합니다. 두 팔레트는 같은 의미 기반 키를 가지며 컴포넌트 내부에 색상 리터럴을 두지 않습니다.

- 다크 팔레트 기준색: `#0F1115`, `#1C1F26`, `#7C5CFF`, `#A78BFA`, `#E5E7EB`
- 라이트 팔레트 기준색: `#F7F7FB`, `#ECECF1`, `#7C3AED`, `#A78BFA`, `#1F2937`
- 현재 생성 UI는 `Colors.dark`를 고정 사용합니다. 팔레트 정의만 준비했으며 사용자 테마 전환은 구현하지 않았습니다.

## 주요 설계 결정

| ADR | 제목 | 핵심 내용 |
|---|---|---|
| [ADR-001](decisions/ADR-001-native-module-architecture.md) | 네이티브 모듈 구조 | Expo Modules API + JNI + git submodule |
| [ADR-002](decisions/ADR-002-vulkan-ndk-build.md) | Vulkan NDK 빌드 전략 | ANDROID_PLATFORM=28, arm64-v8a only |
| [ADR-003](decisions/ADR-003-poc-benchmark-results.md) | SD 1.5 온디바이스 PoC | Q4_K + LCM-LoRA 기능 PoC 성공, VAE decode가 병목 |
| [ADR-004](decisions/ADR-004-expo-dependency-version-policy.md) | Expo 의존성 버전 정책 | SDK 57 호환 버전과 루트–모듈 lockfile 동기화 |
| [ADR-005](decisions/ADR-005-ui-composition-and-theme.md) | 생성 UI 구성과 테마 | React Native 중심 하이브리드 UI, 자체 LoRA 정렬, 단일 `Colors` 팔레트 |

## 의존성 및 검증 경계

- 루트 `package-lock.json`은 앱 설치 그래프를, `stable-diffusion/package-lock.json`은 독립 모듈 개발·빌드 그래프를 고정합니다.
- Expo 패키지는 `npx expo install --check`가 제시하는 SDK 57 호환 버전을 사용합니다.
- TypeScript는 `expo/types`를 직접 참조하고 `stable-diffusion/cpp/`를 검사 대상에서 제외합니다. C++ 서브모듈의 TypeScript 예제는 루트 앱 타입 검사의 책임이 아닙니다.
- 의존성 변경 검증 순서는 `npx expo install --check` → `npx expo-doctor`입니다.
- 앱 코드 변경은 `npx tsc --noEmit` → `npm run lint` → `npm run format:check`로 검증합니다. 로컬 모듈을 수정했다면 마지막에 모듈 `npm run build`도 실행합니다.

## 코드 품질 도구

- ESLint는 Expo SDK 57의 flat config인 `eslint-config-expo/flat`을 그대로 사용합니다. `npm run lint`는 정적 오류와 Expo·React 규칙 위반을 검사합니다.
- Prettier 3.9.6은 `printWidth: 100`, 작은따옴표, trailing comma를 적용합니다. `npm run format`은 수정하고 `npm run format:check`는 변경 없이 검사합니다.
- ESLint와 Prettier의 책임을 섞지 않습니다. 객체와 JSX 줄바꿈 같은 표현 형식은 Prettier에 맡기고, ESLint 규칙을 포맷 용도로 추가하지 않습니다.
- 생성물과 외부 코드인 `android/`, `dist/`, `node_modules/`, `stable-diffusion/`은 Prettier 대상에서 제외합니다. `AGENTS.md`, `docs/`, `assets/`도 현재 자동 포맷 대상이 아닙니다.
