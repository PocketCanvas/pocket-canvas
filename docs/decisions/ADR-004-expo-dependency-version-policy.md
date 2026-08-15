# ADR-004: Expo 의존성 버전 및 lockfile 동기화 정책

## Status
Accepted

## Date
2026-08-16

## Context
Pocket Canvas는 루트 Expo 앱이 로컬 `stable-diffusion` 패키지를 `file:` 의존성으로 사용합니다. 두 패키지는 같은 React Native 런타임에 연결되므로 React Native 버전이 다르면 `NativeMicrotasksCxx could not be found` 같은 TurboModule 로딩 오류가 발생합니다.

기존 모듈 manifest는 React Native 0.86.2를 선언했지만 lockfile에는 0.82.1이 남아 있었고, Expo 55용 Babel/Jest 도구와 Expo 57 패키지가 섞여 있었습니다. 루트 설치만으로는 모듈의 독립 lockfile이 갱신되지 않으므로 manifest 일치만으로는 재현 가능한 설치를 보장할 수 없습니다.

## Decision

- Expo SDK 57을 유지하며 Expo CLI가 제시하는 최신 SDK 57 호환 패치 버전을 사용합니다.
- 루트 앱과 로컬 모듈은 Expo 57.0.13, React Native 0.86.2, React 19.2.3을 공유합니다.
- 모듈의 Babel preset, Jest preset, React 타입과 TypeScript도 SDK 57 세대로 맞춥니다.
- `package-lock.json`과 `stable-diffusion/package-lock.json`을 각각 유지합니다. 모듈 의존성을 먼저 설치한 뒤 루트 의존성을 설치합니다.
- 버전 변경 후 `npx expo install --check`와 `npx expo-doctor`를 통과해야 합니다.
- `npm audit fix --force`는 Expo 호환 버전을 강등하거나 범위를 벗어날 수 있으므로 사용하지 않습니다. 호환 범위 내 수정만 적용하고 나머지 전이 의존성 경고는 Expo 업데이트로 해소합니다.

## Alternatives Considered

### 모든 패키지를 npm 최신 버전으로 독립 업데이트

- React Native와 Expo 네이티브 모듈은 SDK별 호환 세트가 있으므로 개별 최신 버전 조합은 빌드 안정성을 보장하지 못합니다.
- Expo CLI의 호환성 검사 결과를 기준으로 하는 방식보다 안전하지 않아 채택하지 않습니다.

### 모듈 lockfile 제거

- 루트 앱 설치는 단순해지지만 모듈을 독립적으로 빌드·검사할 때의 재현성이 사라집니다.
- 로컬 Expo 모듈 자체의 개발 경계를 유지하기 위해 두 lockfile을 유지합니다.

### npm workspace로 통합

- 의존성 중복과 설치 순서를 줄일 수 있지만 현재 두 패키지 구조는 `file:` 의존성으로 정상 동작합니다.
- 버전 동기화만을 위해 workspace 마이그레이션을 추가하는 것은 불필요한 구조 변경이므로 보류합니다.

## Consequences

- 루트와 모듈의 React Native ABI 및 React 런타임이 일치합니다.
- 새 clone에서도 두 lockfile을 통해 동일한 SDK 57 도구 체인을 재현할 수 있습니다.
- 모듈 manifest 변경 시 두 위치에서 설치·검증해야 합니다.
- Expo SDK를 올릴 때는 루트와 모듈을 같은 작업에서 함께 갱신해야 합니다.
