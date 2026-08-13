# ADR-001: React Native ↔ C++ 연동을 위한 네이티브 모듈 구조

## Status
Accepted

## Date
2026-08-11

## Context
Pocket Canvas는 7GB에 달하는 Stable Diffusion 모델을 안드로이드 기기에서 직접 추론해야 합니다. React Native 앱에서 무거운 C++ 추론 코드를 오버헤드 없이 실행하기 위한 네이티브 통합 구조가 필요했습니다.

핵심 요구사항:
- C++ 코어(`stable-diffusion.cpp`)를 수정하지 않고 사용할 것 (업스트림 추적성 유지)
- React Native(JS)에서 C++ 함수를 비동기로 호출할 수 있을 것
- 네이티브 빌드가 Expo 생태계와 자연스럽게 통합될 것

## Decision
Expo Modules API를 사용하여 로컬 모듈(`stable-diffusion`)을 생성하고, 내부에 C++ 빌드 환경을 구축합니다.

### 계층 구조

```
JS (generateImage)
  → TypeScript Module (stable-diffusion/src/index.ts)
    → Kotlin Module (StableDiffusionModule.kt) — Expo Modules API
      → JNI (System.loadLibrary("stable_diffusion_bridge"))
        → C++ Bridge (StableDiffusionBridge.cpp)
          → stable-diffusion.cpp (git submodule, 수정 금지)
```

### 핵심 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---|---|---|
| TS 인터페이스 | `stable-diffusion/src/index.ts` | JS에 `generateImage()`, `getSystemInfo()` export |
| Kotlin 브릿지 | `StableDiffusionModule.kt` | `System.loadLibrary` + JNI 호출 + 경로 결정 + 비동기 실행 |
| C++ 브릿지 | `StableDiffusionBridge.cpp` | JNI 함수 구현 — sd_ctx 생성, 추론 실행, PNG 저장 |
| C++ 코어 | `cpp/stable-diffusion.cpp/` | Git submodule — ggml, Vulkan 백엔드 포함 |
| 빌드 시스템 | `android/CMakeLists.txt` + `build.gradle` | CMake → `libstable_diffusion_bridge.so` 동적 라이브러리 |

## Alternatives Considered

### React Native JSI 직접 바인딩
- **장점:** Expo 없이 C++를 직접 JS에 바인딩, 이론적으로 오버헤드 최소
- **단점:** JSI 바인딩 코드를 직접 관리해야 함, Expo 생태계 미활용, 보일러플레이트 과다
- **기각 사유:** Expo Modules API가 JSI 위에 추상화를 제공하면서도 충분히 빠르고, 빌드 시스템 통합이 자연스러움

### Turbo Modules (RN 공식)
- **장점:** React Native 공식 네이티브 모듈 시스템
- **단점:** Expo Modules API 대비 설정이 복잡하고, codegen 단계가 추가됨
- **기각 사유:** 이미 Expo 생태계를 사용 중이므로 Expo Modules API가 더 자연스러운 선택

## Consequences
- **장점:** 업스트림 C++ 코드를 submodule로 관리하므로 최신 버전 추적이 용이
- **장점:** 커스텀 로직이 JNI 브릿지 한 곳에 집중되어 유지보수 범위가 명확
- **장점:** Expo autolinking이 자동으로 모듈을 앱에 연결
- **제약:** TS 소스 수정 후 `npm run build` 필수 (앱은 `build/index.js`를 참조)
- **제약:** react-native 버전이 루트와 모듈 간 100% 일치해야 함 (불일치 시 TurboModule 크래시)
