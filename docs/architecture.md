# Pocket Canvas — 아키텍처 개요

## 시스템 개요
Pocket Canvas는 안드로이드 기기에서 Stable Diffusion 모델을 온디바이스로 구동하는 앱입니다.

현재 JavaScript 런타임 기준 버전은 Expo 57.0.13, React Native 0.86.2, React 19.2.3입니다. 루트 앱과 로컬 Expo 모듈은 같은 버전 세대를 사용합니다.

```
┌─ React Native (Expo SDK 57) ─────────────────────┐
│  src/app/index.tsx                                │
│  └─ 모델·LoRA·steps·출력 경로로 generateImage 호출   │
├───────────────────────────────────────────────────┤
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
│   │   ├── models.tsx           # 모델 파일 관리 화면
│   │   ├── history.tsx          # 생성 이미지 히스토리 화면
│   │   └── settings.tsx         # 설정 탭 자리표시자
│   ├── components/              # 생성 컨트롤, 선택기, LoRA 정렬, 모델 관리, 히스토리 컴포넌트
│   ├── constants/theme.ts       # Colors, Spacing, Fonts 디자인 토큰
├── android/                     # Expo prebuild/run 시 생성되는 앱 레벨 Android 설정 (gitignore)
├── docs/
│   ├── architecture.md          # 이 문서
│   └── decisions/               # ADR (Architecture Decision Records)
│       ├── ADR-001-native-module-architecture.md
│       ├── ADR-002-vulkan-ndk-build.md
│       ├── ADR-003-poc-benchmark-results.md
│       ├── ADR-004-expo-dependency-version-policy.md
│       ├── ADR-005-ui-composition-and-theme.md
│       ├── ADR-006-app-storage-and-model-import.md
│       └── ADR-007-generation-contract-progress-and-image-storage.md
├── tasks/                       # 작업 계획 (spec, plan, todo)
├── AGENTS.md                    # AI 에이전트 지침 (최상위 규칙)
└── package.json                 # 루트 앱 의존성
```

## 데이터 플로우: 이미지 생성

1. 사용자가 프롬프트 입력 → Generate 버튼 클릭
2. 모델, LoRA 목록·가중치, steps와 영구 출력 경로를 Expo Modules 비동기 호출로 전달
3. Kotlin이 URI를 앱 전용 저장소 내부 경로인지 검증한 뒤 JNI로 전달
4. JNI로 C++ 진입 → `new_sd_ctx(mmap=true, vulkan)` → 모델 로드
5. `generate_image()` → Vulkan GPU에서 디노이징 루프 실행
6. 브리지가 `Loading → Encoding → Steps → Decoding` 진행 이벤트를 JS에 전송
7. `stbi_write_png()` → `Paths.document/images/YYYYMMDD-HHMMSS-<id>.png`에 저장
8. 파일 URI를 JS로 반환해 `<Image>`에 렌더링하고 `images/meta.json`에 생성 설정 기록

모델과 LoRA 선택기는 자동 분류를 기본 필터로 사용하지만 `전체 보기`를 켜면 모든 가져온 파일을 선택할 수 있습니다. 호환성 자동 판별은 하지 않으며 잘못된 조합은 네이티브 추론 오류로 처리합니다.

progress callback은 모델 tensor 로딩과 sampling에 함께 사용됩니다. C++ 브리지는 현재 단계를
별도로 추적하고 `get_learned_condition completed` 이후 callback만 sampling으로 전달합니다.
loading은 전체 tensor 개수가 제공될 때 실제 백분율을, sampling은 `N/M`을 표시합니다.
encoding과 decoding은 총 작업량을 알 수 없어 백분율 없이 현재 단계만 표시합니다.

현재 선택 가능한 추론 인자는 모델, LoRA·가중치와 steps입니다. 해상도 512×512, LCM
sampler/scheduler와 CFG 1.0은 PoC 설정을 유지하며 생성마다 context를 만들고 해제합니다.

## 앱 저장소

Pocket Canvas의 영구 파일은 Expo FileSystem의 `Paths.document` 아래에 기능별 디렉터리로 저장합니다. 이 영역은 앱 전용 저장소이며 앱 삭제 전까지 유지됩니다. 캐시와 임시 생성물은 영구 데이터로 취급하지 않습니다.

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

| 위치 | 용도 | 수명 |
|---|---|---|
| `Paths.document/models/` | 가져온 모델 파일과 `models.json` | 사용자가 삭제하거나 앱을 제거할 때까지 |
| `Paths.document/images/` | 생성 PNG와 최선 노력으로 기록하는 `meta.json` | 사용자가 삭제하거나 앱을 제거할 때까지 |
| `Paths.cache` / 네이티브 `cacheDir` | 다시 만들 수 있는 생성 결과·작업 파일 | OS가 회수할 수 있음 |

PNG 저장 성공이 최우선이며 `meta.json` 기록 실패는 PNG를 삭제하지 않습니다. 각 기능은 자기 디렉터리와 인덱스를 소유하며 다른 기능의 파일을 직접 변경하지 않습니다.

`meta.json`에는 이미지 ID와 파일명, 생성 시각, prompt, steps, 사용한 모델의 ID·표시 이름·내부
파일명, 순서가 보존된 LoRA 목록과 각 가중치, 즐겨찾기(`favorite`) 상태를 기록합니다. history 화면은
이 데이터를 읽고 디렉토리 스캔을 병행하여 고아 이미지를 자동 복구합니다.

### 모델 가져오기

1. `expo-document-picker`로 파일을 선택하고 picker의 `asset.name`을 원본 표시 이름으로 사용합니다. Android의 `content://` URI basename은 실제 파일명을 보존하지 않을 수 있습니다.
2. 표시 이름의 확장자가 `.safetensors` 또는 `.gguf`인지 확인합니다. 확장자는 빠른 필터일 뿐 신뢰 경계가 아닙니다.
3. 원본을 `.importing-<ID>.<확장자>`로 앱 저장소에 복사합니다.
4. 복사본의 magic/header와 tensor directory를 부분 읽기하여 실제 형식과 모델·LoRA 여부를 판별합니다. 전체 tensor payload는 읽지 않습니다.
5. 유효하면 `<ID>.<확장자>`로 이동하고 `models.json`을 갱신합니다. 실패하면 임시 파일을 삭제합니다.

유효한 GGUF/SafeTensors지만 tensor signature로 종류를 확정하지 못한 파일만 `unknown`으로 저장합니다. PNG, 손상된 파일, 확장자만 바꾼 파일처럼 실제 형식 검증에 실패한 입력은 저장하지 않습니다.

앱 시작 시 남아 있는 `.importing-*` 파일을 정리합니다. 인덱스는 `.models.json.tmp`에 먼저 쓴 뒤 `models.json`으로 이동하여 중간 상태가 노출되는 시간을 줄입니다.

### `models.json`

`models.json`은 배열 하나이며 모델 바이너리와 사용자가 편집하는 정보를 분리합니다.

```json
[
  {
    "id": "m1-example",
    "fileName": "original.safetensors",
    "storedFileName": "m1-example.safetensors",
    "alias": "My model",
    "kind": "model",
    "detectedKind": "model",
    "format": "safetensors",
    "sizeBytes": 2134567890,
    "description": "",
    "createdAt": "2026-08-17T00:00:00.000Z"
  }
]
```

- `fileName`: 선택 당시 원본 표시 이름
- `storedFileName`: 앱 내부에서 충돌 없이 사용하는 파일명
- `alias`, `description`, `kind`: 사용자가 변경할 수 있는 값
- `detectedKind`: 가져오기 시 자동 판별 결과
- `format`: header로 확인한 실제 파일 형식

현재 인덱스는 스키마 버전이나 마이그레이션 계층을 두지 않습니다. 스키마를 변경해야 할 때 데이터 호환 요구가 생기면 그 시점에 버전과 마이그레이션을 추가합니다.

### 삭제와 일관성

모델 삭제는 먼저 인덱스를 갱신하고 파일 삭제가 실패하면 이전 인덱스를 복원합니다. 가져오기 중 인덱스 기록이 실패하면 이미 이동한 모델 파일도 삭제합니다. `models.json` 자체가 손상되었거나 예상 스키마와 다르면 빈 목록으로 덮어쓰지 않고 오류를 표시합니다.

구현 진입점은 `src/lib/model-files.ts`, 형식 판별기는 `src/lib/model-file-inspection.ts`입니다. 설계 배경은 [ADR-006](decisions/ADR-006-app-storage-and-model-import.md)을 참고하세요.

## 생성 UI 구성

- `src/app/index.tsx`는 화면 상태와 생성 호출을 조정합니다.
- `generation-controls.tsx`는 하단 추론 스텝과 생성 버튼을, `generation-pickers.tsx`는 모델·LoRA 선택 모달을 담당합니다.
- `lora-sortable-list.tsx`는 Gesture Handler와 Reanimated로 멀티 LoRA 순서 변경을 구현합니다.
- 일반 배치, 텍스트, 카드, 모달은 React Native를 사용하고 슬라이더·버튼처럼 네이티브 동작이 유리한 부분만 Expo UI Jetpack Compose를 사용합니다.

## 히스토리 화면 및 이미지 관리

- `src/app/history.tsx`는 화면 상태, 검색/정렬 필터링, `useFocusEffect` 갱신을 담당합니다.
- `src/components/history-management.tsx`는 3열 그리드 카드(`HistoryCard`), 상세 바텀시트 모달(`HistoryDetailModal`)을 제공합니다.
- '전체'와 '즐겨찾기' 2개 탭으로 구성되며, 카드 우상단 하트 오버레이를 통해 즉각적인 즐겨찾기 토글이 가능합니다.
- 이미지 파일 공유는 `expo-sharing`을 사용하여 실제 PNG 파일을 네이티브 시스템 공유 시트로 전달합니다.
- 상세 모달은 배경 터치 닫기와 내부 `ScrollView` 스크롤 제스처를 명확히 분리하여 하단 삭제 버튼까지 부드럽게 스크롤할 수 있습니다.
- `src/lib/image-files.ts`는 `meta.json`과 `Paths.document/images/` 디렉토리 스캔을 병행하여 누락된 고아 PNG도 타임스탬프로 자동 복구합니다. 설계 배경은 [ADR-008](decisions/ADR-008-history-ui-and-image-management.md)을 참고하세요.

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
| [ADR-006](decisions/ADR-006-app-storage-and-model-import.md) | 앱 저장소와 모델 가져오기 | Expo 문서 저장소, header 검증, JSON 인덱스와 실패 롤백 |
| [ADR-007](decisions/ADR-007-generation-contract-progress-and-image-storage.md) | 생성 계약, 진행 상태와 이미지 저장 | 커스텀 모델·LoRA·steps 계약, 4단계 진행 이벤트, 영구 PNG와 best-effort 메타데이터 |
| [ADR-008](decisions/ADR-008-history-ui-and-image-management.md) | 히스토리 화면과 이미지 관리 | 3열 그리드, 2탭 필터, expo-sharing 이미지 공유, 모달 스크롤 제스처 분리, 고아 파일 자동 복구 |

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
