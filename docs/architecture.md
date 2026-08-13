# Pocket Canvas — 아키텍처 개요

## 시스템 개요
Pocket Canvas는 안드로이드 기기에서 Stable Diffusion 모델을 온디바이스로 구동하는 앱입니다.

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
│   │   ├── index.tsx            # 홈 화면 (이미지 생성 UI)
│   │   └── explore.tsx          # 탐색 탭 (Expo 스타터)
│   ├── components/              # ThemedText, ThemedView 등 공통 UI
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
├── android/                     # 앱 레벨 Android 설정
├── docs/
│   ├── architecture.md          # 이 문서
│   └── decisions/               # ADR (Architecture Decision Records)
│       ├── ADR-001-native-module-architecture.md
│       ├── ADR-002-vulkan-ndk-build.md
│       └── ADR-003-poc-benchmark-results.md
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

## 주요 설계 결정

| ADR | 제목 | 핵심 내용 |
|---|---|---|
| [ADR-001](decisions/ADR-001-native-module-architecture.md) | 네이티브 모듈 구조 | Expo Modules API + JNI + git submodule |
| [ADR-002](decisions/ADR-002-vulkan-ndk-build.md) | Vulkan NDK 빌드 전략 | ANDROID_PLATFORM=28, arm64-v8a only |
| [ADR-003](decisions/ADR-003-poc-benchmark-results.md) | SD 1.5 온디바이스 PoC | Q4_K + LCM-LoRA 기능 PoC 성공, VAE decode가 병목 |
