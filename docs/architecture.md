# Pocket Canvas Architecture

## Overview
Pocket Canvas는 Android에서 Stable Diffusion inference를 온디바이스로 실행하는 Expo + React Native 애플리케이션

JS/UI 계층은 Expo Modules API를 통해 Kotlin native module을 호출하고, Kotlin은 JNI bridge를 통해 `stable-diffusion.cpp` 기반 C++ inference core와 통신한다

```text
React Native / Expo
        │
        ▼
Expo Module (Kotlin)
        │
       JNI
        │
        ▼
StableDiffusionBridge.cpp
        │
        ▼
stable-diffusion.cpp
        │
        ▼
ggml / Vulkan
```

`stable-diffusion.cpp`는 git submodule로 관리하며 Pocket Canvas의 custom native logic은 bridge 계층에서 구현

## Generation flow

```text
Prompt / Model / LoRA / Steps / Optional TAESD
            │
            ▼
        React Native
            │
            ▼
       Expo Module
            │
            ▼
           JNI
            │
            ▼
      C++ inference
            │
            ├─ Loading
            ├─ Encoding
            ├─ Sampling
            └─ Decoding
            │
            ▼
        PNG storage
            │
            ▼
      React Native UI
```

1. JS에서 생성 요청을 구성
2. Kotlin 계층에서 앱 storage URI 등 native boundary를 검증
3. JNI bridge가 inference context를 생성
4. stable-diffusion.cpp가 Vulkan backend에서 inference를 수행
5. bridge가 생성 단계를 JS progress event로 변환
6. 생성 결과를 앱 document storage에 PNG로 저장
7. JS가 결과 URI와 metadata를 UI/history에 반영

> 상세 내용은 ADR-007 참조

TAESD를 선택하면 별도 가중치 경로가 TS → Kotlin → JNI 계약을 통해
`sd_ctx_params_t.taesd_path`로 전달되고 최종 decode의 기본 VAE를 대체한다. TAESD는
실험 옵션이며 품질 저하 때문에 기본값으로 사용하지 않는다. → ADR-009

## Quantization flow

```text
Imported SafeTensors / GGUF
            │
            ▼
  .quantizing-<id>.gguf
            │ tensor streaming convert
            ▼
      GGUF header validation
            │
            ▼
  <id>.gguf + models.json commit
            │
            ▼
       mmap inference
```

양자화는 Android 기기 안에서 upstream `convert()`를 호출한다. 원본은 보존하고 결과를 새 모델로
등록한다. 변환 입력 자체는 mmap이 아니며 tensor별 스트리밍을 사용한다. 생성과 양자화는 동시에
실행하지 않는다. → ADR-014

## Heavy operation coordination

이미지 생성, 모델 양자화, 모델 가져오기는 비영속 Zustand 잠금으로 하나만 시작한다. 모델·이미지 JSON의 짧은 read-modify-write 구간은 저장소별 JS 큐로 직렬화하고, 생성·양자화의 네이티브 안전성은 `StableDiffusionBridge.cpp` mutex가 최종 보장한다. 히스토리 탐색과 이미지 관리는 무거운 작업 중에도 계속 사용할 수 있다.

```text
React / Zustand        충돌 요청 즉시 거절, blocked UX
        │
        ├── model index queue   models.json read-modify-write 직렬화
        ├── image index queue   images/meta.json read-modify-write 직렬화
        │
Kotlin operation scope 생성·양자화를 Expo 공용 AsyncFunctionQueue와 분리
        │
JNI bridge mutex       생성·양자화의 최종 동시 실행 방지
```

전역 store에는 작업 종류·표시명·시작 시각·소유 ID만 둔다. 생성 진행률은 생성 화면에, 양자화 진행률은 모델 관리 화면에만 유지하며 다른 탭에 전역 진행 배너를 표시하지 않는다. 모델 가져오기·양자화·삭제·이름·설명·분류 변경은 무거운 작업 중 차단하지만, 차단된 control의 press는 안내 Alert를 표시하기 위해 유지한다.

생성과 양자화 JNI 호출은 Expo Modules 공용 `AsyncFunctionQueue`가 아닌 별도 coroutine scope에서 실행한다. 긴 네이티브 작업이 FileSystem·Sharing 같은 독립 Expo 모듈 호출을 막지 않도록 하기 위함이다.

> 상세 내용은 ADR-015 참조

## Native boundary
1. Expo module: JS 에 asynchronous native API와 event interface를 제공
2. Kotlin: Android lifecycle, URI/storage validation 및 JNI 호출을 담당
3. JNI bridge: Pocket Canvas 전용 inference orchestration과 `stable-diffusion.cpp` API adaptation을 담당한다.
4. stable-diffusion.cpp: 실제 model loading 및 diffusion inference를 수행하는 upstream core

## Persistence

```text
Paths.document/
├── models/
│   ├── models.json
│   ├── <내부 ID>.safetensors
│   └── <내부 ID>.gguf
└── images/
    ├── meta.json
    └── YYYYMMDD-HHMMSS-<id>.png
```
* `models/`: imported model 및 LoRA 와 metadata
* `images/`: generated PNG와 현행 생성 옵션 전체를 포함하는 metadata

> 가져오기는 validation 후 commit하며 실패한 import가 정상 데이터에 영향을 주지 않도록 rollback 가능한 흐름을 사용
>
> PNG 보존을 우선한다. metadata 기록이 실패한 PNG는 디렉터리 스캔으로 복구하되, 알 수 없는 생성 설정을 합성하지 않고 `missing` 상태로 히스토리에 표시한다. → ADR-012


## UI boundaries

React Native가 화면 구성과 상태 orchestration을 담당

Native interaction의 이점이 있는 일부 control만 Expo UI를 사용하며, 앱 전체 navigation과 layout은 React Native 계층에 유지

History UI와 생성 UI는 화면 state와 reusable presentation component의 책임을 분리

생성 화면의 React 상태는 입력 중인 생성 설정과 실행 lifecycle을 분리한다.
`generationDraftReducer`는 prompt, 리소스 선택, sampling, 해상도, seed와 hires 설정을 소유하고,
`generationRunReducer`는 `idle`, `running`, `succeeded`, `failed` 전이와 진행 이벤트, 결과 이미지,
오류·경고를 소유한다. 화면 컴포넌트는 두 reducer를 조정하고 native 호출과 저장 부수 효과를 수행한다.

모델 목록은 화면 focus 때 다시 읽으며 draft reducer가 선택된 model·TAESD·LoRA를 ID로 현재 catalog와
재조정한다. 삭제된 리소스는 선택에서 제거하고, 남아 있는 LoRA는 새 레코드를 사용하면서 기존 weight를
보존한다. 실행 시작 시에는 직전 성공 이미지를 별도로 보존한다. 생성 실패는 그 이미지를 유지하고,
PNG 생성 뒤 metadata 기록만 실패한 경우는 warning을 가진 성공 상태로 표현한다.

히스토리 그리드에서 이미지를 선택하면 현재 탭·검색·정렬 결과가 전체 화면
`HistoryImageViewer`로 전달된다. `react-native-zoom-toolkit`의 `Gallery`가 제한 렌더링,
좌우 페이징과 핀치 확대를 하나의 제스처 상태로 처리하고, React 화면 상태는 선택 ID와
즐겨찾기·공유·삭제·상세 정보 액션을 관리한다. Android `Modal` 내부에는 별도의
`GestureHandlerRootView`를 둔다.

→ ADR-005
→ ADR-008
→ ADR-013
→ ADR-016
