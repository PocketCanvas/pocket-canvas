# ADR-023: 프로젝트 소유 네이티브 코드의 책임별 모듈화

## Status

Accepted

이 ADR은 ADR-001, ADR-010, ADR-014, ADR-015, ADR-017, ADR-018, ADR-021에 기록된 동작 계약은 유지하면서, 프로젝트 소유 Kotlin/C++ 코드의 파일 소유권 설명을 갱신한다.

## Date

2026-09-08

## Context

초기 Pocket Canvas의 네이티브 계층은 Expo Kotlin 모듈이 `StableDiffusionBridge.cpp`를 통해 upstream `stable-diffusion.cpp`를 호출하는 얇은 구조였다. 이후 양자화, 메모리 정책, 단계별 진행 이벤트, durable breadcrumb, Vulkan 식별과 tombstone 기반 크래시 보고가 추가되면서 Kotlin 모듈과 C++ bridge가 각각 여러 독립 책임을 함께 소유하게 되었다.

프로젝트 규칙은 커스텀 추론·양자화 정책을 upstream 서브모듈이 아닌 프로젝트 소유 C++ 계층에 두기 위한 것이었다. 이를 모든 C++ 코드를 `StableDiffusionBridge.cpp` 한 파일에만 작성해야 한다는 규칙으로 유지하면 앞으로 기능을 추가할수록 JNI 조정과 도메인 로직의 경계가 흐려진다. Kotlin 역시 단순 JNI 호출기만이 아니라 Expo 계약, Android 저장소 검증, 실행 큐와 프로세스 종료 진단을 담당하므로 책임별 분리가 필요하다.

## Decision

- 프로젝트 소유 C++ 코드는 `stable-diffusion/cpp/` 아래에서 책임별 `.h/.cpp` 파일로 나눈다.
- `StableDiffusionBridge.cpp`는 JNI 진입점, 요청 실행 순서와 native 자원 수명을 소유한다.
- 옵션 변환, 메모리 정책, 로그 수집, 생성 진단과 callback 처리를 독립 모듈로 분리한다.
- 로그 수집기는 ring buffer와 문자열 정제만 소유하고, 생성 진단은 JSON 스키마와 durable 파일 기록을 소유한다.
- Kotlin은 Expo/JNI 호출 조정, 입력 계약 검증, Android 앱 저장소 경계와 크래시 보고 조립을 책임별 파일로 나눈다.
- Kotlin과 C++는 파일 이름을 기계적으로 1:1 대응시키지 않는다. JNI entry point와 공개 인자 계약만 양쪽 경계로 취급한다.
- 기존 JNI callback lookup을 보존하기 위해 native `external` 선언과 `@Keep` progress 메서드는 `StableDiffusionModule`에 유지한다.
- upstream `stable-diffusion.cpp` 서브모듈은 계속 수정하지 않는다.

이번 구조 변경은 observable behavior를 바꾸지 않는다. 기존 로그 수집, breadcrumb 삭제 시점과 종료 정보 매칭의 결함은 별도 변경에서 재현 테스트와 함께 수정한다.

## Alternatives Considered

### 단일 Kotlin/C++ 파일 유지

파일 검색은 단순하지만 독립적인 변경이 같은 파일과 callback 상태를 공유한다. 앞으로 기능이 추가될수록 리뷰 범위와 회귀 위험이 커져 채택하지 않는다.

### Kotlin과 C++ 파일을 기능별로 완전히 1:1 대응

JNI 함수는 읽기 쉬워지지만 Android URI 검증과 `ApplicationExitInfo`처럼 C++에 대응할 책임이 없는 기능까지 대칭 구조를 강요한다. 중복 계층과 잘못된 소유권을 만들기 때문에 채택하지 않는다.

### 결함 수정과 구조 변경을 함께 수행

최종 코드량은 줄어들 수 있지만 구조 이동과 동작 변경의 회귀 원인을 분리하기 어렵다. 먼저 동작 보존형 모듈화를 완료한 뒤 결함을 작은 후속 변경으로 다룬다.

## Consequences

- 새 네이티브 기능은 JNI 조정 파일을 키우지 않고 소유 모듈에 추가할 수 있다.
- 로그 개인정보 정책은 생성 진단 스키마와 분리해 집중적으로 테스트하고 변경할 수 있다.
- CMake source 목록과 내부 헤더 계약을 관리해야 한다.
- JNI에 노출되지 않는 내부 API가 늘어나지만 모두 프로젝트 전용이며 공개 Expo API는 변하지 않는다.
- AGENTS 규칙은 “커스텀 네이티브 로직은 프로젝트 소유 C++ 모듈에 작성한다”로 갱신되며 각 책임의 변경 위치를 명시한다.
