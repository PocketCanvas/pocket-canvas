# Pocket Canvas 프로젝트: AI 에이전트 지침 및 시스템 프롬프트 (AGENTS.md)

이 문서는 AI 에이전트들이 이 프로젝트를 파악하고 작업할 때 반드시 지켜야 할 **핵심 철학, 시스템 구조, 그리고 과거의 삽질(시행착오) 기록**을 담고 있습니다. 코드를 작성하거나 아키텍처를 변경하기 전에 반드시 숙지하세요.

## 1. 앱 철학 및 기본 원칙 (Core Philosophy)
- **온디바이스 AI 앱:** "Pocket Canvas"는 안드로이드(향후 iOS 확장 가능) 환경에서 **C++ 코어(stable-diffusion.cpp)를 활용하여 기기 자체에서 모델을 돌리는 앱**입니다.
- **성능 최우선:** 메모리 부족, 배터리 소모, 빌드 속도 등을 항상 염두에 두어야 합니다. (16KB 메모리 정렬 등 네이티브 성능 최적화가 필수적입니다.)
- **점진적이고 검증된 통합 (Step-by-Step PoC):** 복잡한 구조를 한 번에 설계하려 하지 마세요. 거대한 AI 모델을 로드하기 전에, C++에서 `Hello World` 수준의 간단한 문자열(`getSystemInfo()`)을 JS로 넘기는 것부터 확실히 검증하는 식의 "돌다리 두들기기" 접근법을 사용해야 합니다.
- **서브모듈(Submodule) 기반 네이티브 통합:** 업스트림 C++ 코드(`stable-diffusion.cpp`)는 수정하지 않고 `git submodule`로 가져와 사용합니다. 커스텀 로직은 JNI 브릿지(`StableDiffusionBridge.cpp`) 계층에서만 작성하여 업스트림 추적성을 유지합니다.

## 2. 개발 및 프레임워크 지침 (General Rules)
- **Expo HAS CHANGED:** 현재 Expo(SDK 57) 및 React Native(0.86.2)의 최신 아키텍처를 사용 중입니다. 구형 지식에 의존하지 말고, 코드 작성 전 반드시 [공식 문서(https://docs.expo.dev/versions/v57.0.0/)](https://docs.expo.dev/versions/v57.0.0/)를 찾아보는 **소스 주도 개발(Source-Driven Development)**을 실천하세요.
- **버전 일치화 (Strict Versioning):** 모듈과 루트 간의 패키지 버전(특히 `react-native`)이 조금이라도 어긋나면 네이티브 빌드가 끔찍하게 꼬입니다. 항상 루트의 `package.json`과 모듈의 `package.json` 버전을 동기화하세요.

## 3. 아키텍처 결정 기록 (ADR: Architecture Decision Records)

### ADR-001: React Native ↔ C++ 연동을 위한 네이티브 모듈 구조
- **배경:** 무거운 C++ 추론 코드를 React Native 앱에서 오버헤드 없이 실행해야 함.
- **결정:** Expo Modules API를 사용하여 로컬 모듈(`stable-diffusion`)을 생성하고, 내부에 C++ 빌드 환경을 구축함.
- **구조:**
  - **프론트엔드:** React Native (0.86.2) + Expo SDK 57 + TypeScript
  - **네이티브 브릿지 (Android):** Kotlin(`StableDiffusionModule.kt`)에서 `System.loadLibrary("stable_diffusion_bridge")`를 통해 C++ 라이브러리를 로드함.
  - **C++ 빌드 시스템:** `android/build.gradle`의 `externalNativeBuild`를 통해 CMake를 실행함. `CMakeLists.txt`는 `StableDiffusionBridge.cpp`를 동적 라이브러리(`libstable_diffusion_bridge.so`)로 컴파일하며, 내부에 `ggml` 등의 코어를 정적 링크함.

## 4. 트러블슈팅 및 알려진 이슈 (Gotchas & Historical Context)
> 과거에 겪었던 치명적 에러들입니다. 같은 실수를 반복하지 마세요.

- **🚨 터보모듈 크래시 (`NativeMicrotasksCxx could not be found`)**
  - **증상:** 앱을 켜자마자 JS 측에서 모듈을 `require` 할 때 위 에러를 뿜으며 사망함.
  - **원인:** 루트(`0.86.2`)와 로컬 모듈(`0.82.1`) 간의 `react-native` 버전 불일치. npm이 두 버전의 NDK 헤더와 C++ 바이너리를 꼬아서 설치해버려 React Native의 새로운 아키텍처(TurboModules) 초기화가 실패함.
  - **해결책:** 항상 모든 `package.json`의 `react-native` 버전을 100% 일치시키고 `npm install`을 다시 돌릴 것.
- **⚠️ 16KB 페이지 사이즈 경고 (`ELF 정렬 검사 실패`)**
  - **증상:** Android 15+ 기기에서 앱 실행 시 16KB 호환성 경고 창이 뜸 (`libreanimated.so`, `libexpo-modules-core.so` 등).
  - **컨텍스트:** 이는 React Native 생태계 전체가 16KB로 넘어가는 과도기적 현상임. 16KB로 정렬되지 않은 라이브러리라도 구형(4KB) 및 최신(16KB) 기기에서 하위 호환되어 완벽히 동작함. 개발 중(Debug)에만 뜨는 경고이므로 기능 구현을 막지 말고 무시할 것.
- **🔄 TypeScript 모듈 빌드 누락**
  - **증상:** `stable-diffusion/src/` 안의 `.ts` 파일을 수정해도 앱에 반영되지 않음.
  - **원인:** 앱은 TS 원본이 아니라 `build/index.js`를 바라봄.
  - **해결책:** 모듈 내부의 JS/TS 코드를 수정했다면 반드시 `stable-diffusion` 폴더 안에서 `npm run build`를 실행하여 컴파일할 것.
