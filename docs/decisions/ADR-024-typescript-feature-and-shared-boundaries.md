# ADR-024: TypeScript 기능·공유 모듈 경계

## Status

Accepted

## Date

2026-09-08

## Context

Pocket Canvas의 TypeScript 코드는 기능이 늘면서 `src/lib`, `src/constants`, `src/stores`에 서로 다른 책임이 함께 쌓였다. `lib`에는 생성 reducer, 모델 파일 parser, 히스토리 query, 이미지 metadata와 생성 진단이 섞였고, 하나의 테마 기능은 constants, store와 hook으로 흩어졌다. 파일 이름을 알고 있을 때는 찾을 수 있지만 디렉터리 구조만으로 변경 위치와 의존 방향을 예측하기 어렵다.

React 화면과 presentation component, lifecycle hook, 순수 기능 로직, 공통 앱 메커니즘, 파일·DB 부수 효과는 변경 이유가 서로 다르다. 기술 형태만으로 분류하는 전역 `lib`, `constants`, `stores`를 계속 확장하면 기능 소유권이 흐려지고 역방향 의존이 생긴다.

## Decision

- `src/features/<feature>/`는 해당 기능의 상태 모델, 정책, parser와 순수 로직을 소유한다. React component와 화면 orchestration은 넣지 않는다.
- `src/shared/<capability>/`는 둘 이상의 feature가 사용하고 단일 feature가 소유하지 않는 앱 공통 기능을 소유한다. 현재 대상은 `theme`과 `heavy-operation`이다.
- `src/components/`는 React UI를, `src/hooks/`는 React lifecycle과 부수 효과 조정을 계속 담당한다.
- `src/storage/`와 `src/database/`는 파일 및 SQLite 부수 효과를 계속 담당한다.
- `StoredModel`처럼 여러 계층이 공유하는 도메인 타입은 storage 구현이 아니라 해당 feature가 소유한다.
- 전역 barrel은 만들지 않는다. 내부 구현 파일이 많은 feature 경계에는 작은 local public facade를 둘 수 있다.

의존 방향은 다음과 같다.

```text
app ───────→ components ───────→ features ───────→ shared
 │                │                  │
 ├─────────────→ hooks ──────────────┤
 │                ├──→ storage ──────┤
 │                └──→ native module │
 └────────────────────────────────→ shared

storage ─→ database
storage ─→ feature domain types/parsers
```

다음 역방향 의존은 만들지 않는다.

- `shared` → `features`
- `features` → `components`, `hooks`, `app`, `storage`, `database`
- `storage`, `database` → `components`, `hooks`, `app`
- `components` → `storage`, `database`

`components`가 feature 타입, 상수와 순수 계산을 사용하는 것은 허용한다. 파일 접근, DB commit과 native 호출은 app 또는 hook orchestration을 통해 수행한다.

목표 구조는 다음과 같다.

```text
src/
├── app/
├── components/
├── hooks/
├── features/
│   ├── generation/
│   ├── images/
│   ├── history/
│   ├── models/
│   └── diagnostics/
├── shared/
│   ├── theme/
│   └── heavy-operation/
├── storage/
└── database/
```

## Alternatives Considered

### 기존 기술 형태별 디렉터리 유지

이동 범위는 작지만 새 파일의 기능 소유권을 계속 파일명과 import를 읽어야 알 수 있다. `lib`가 기능 코드의 기본 수용처가 되는 문제를 해결하지 못한다.

### feature 내부에 component, hook, storage까지 모두 배치

완전한 vertical slice는 기능 단위 탐색에는 유리하다. 하지만 현재 앱은 화면·presentation, lifecycle, FileSystem/SQLite 경계가 이미 명확히 분리되어 있고 ADR-005, ADR-016, ADR-020도 이 책임 구분을 전제로 한다. 이번 구조 변경에서 모든 계층을 함께 이동하면 검토 범위와 회귀 위험이 불필요하게 커진다.

### 모든 공통 코드를 `shared` 한 단계에 평면 배치

`lib`의 모호함을 `shared`로 이름만 바꾸게 된다. `shared/theme`, `shared/heavy-operation`처럼 capability 이름을 반드시 사용한다.

### 전역 barrel export 사용

import 경로는 짧아지지만 실제 소유 위치와 의존 관계를 숨기고 순환 의존을 발견하기 어렵게 한다. 큰 하위 모듈의 local facade만 허용한다.

## Consequences

- 경로만으로 기능 소유자와 코드 성격을 더 쉽게 예측할 수 있다.
- `features`와 `shared`의 순수 로직은 React UI와 storage 없이 단위 테스트할 수 있다.
- 하나의 기능이 `components/<name>`과 `features/<name>`에 함께 나타날 수 있다. 전자는 UI, 후자는 순수 기능 로직이라는 규칙을 유지해야 한다.
- 기존 import 이동량이 크므로 파일 이동과 내부 책임 분리를 별도 단계로 수행하고 단계마다 테스트한다.
- 중첩 feature 디렉터리의 테스트를 놓치지 않도록 test discovery를 먼저 변경해야 한다.
- 이 ADR은 Android/Kotlin/C++ 책임을 정한 ADR-023을 변경하지 않는다.
