# ADR-016: 생성 화면의 draft와 실행 상태 모델 분리

## Status

Accepted

## Date

2026-08-23

## Context

생성 화면은 prompt와 모델 선택 같은 편집 중 설정, 모델 catalog 갱신, native 진행 이벤트,
이전 결과 이미지, 생성 오류와 metadata 저장 경고를 함께 조정한다. 이 상태들을 독립적인 `useState`로
관리하면 하나의 사용자 동작이 여러 setter를 정해진 순서로 호출해야 하고, 서로 양립할 수 없는 상태도
동시에 표현할 수 있다. 예를 들어 생성이 끝났는데 진행 상태가 남거나, 실패하면서 이전 이미지가
사라지거나, PNG 생성 성공 뒤 metadata 기록 실패가 전체 생성 실패처럼 표시될 수 있다.

모델 화면에서 리소스의 이름·분류를 바꾸거나 파일을 삭제한 뒤 생성 화면으로 돌아오면 catalog의 최신
레코드와 기존 선택 객체가 달라질 수 있다. 선택 상태를 그대로 유지하면 삭제된 파일을 native 호출에
전달하거나 변경 전 alias를 metadata에 기록할 수 있다.

## Decision

- 생성 화면 상태를 편집 중인 요청 초안과 실행 lifecycle의 두 영역으로 분리한다.
- `src/lib/generation-draft.ts`의 `GenerationDraft`와 `generationDraftReducer`가 prompt,
  negative prompt, model·TAESD·LoRA 선택, sampling, 해상도, seed와 hires 설정을 소유한다.
- 서로 함께 변하는 값은 `resources`, `sampling`, `seed`, `hires` 하위 상태로 묶고 화면과 하위
  컴포넌트는 action을 dispatch하여 변경한다.
- 모델 catalog를 다시 읽으면 `resourcesReconciled` action으로 선택 항목을 ID 기준으로 재조정한다.
  현재 catalog에 없는 model과 TAESD는 `null`로 바꾸고, 없는 LoRA는 제거한다. 남아 있는 LoRA는
  최신 `StoredModel` 레코드로 교체하되 사용자가 지정한 weight는 보존한다.
- `src/lib/generation-state.ts`의 `GenerationRunState`는 `idle`, `running`, `succeeded`, `failed`
  discriminated union으로 실행 상태를 표현한다. 진행 이벤트는 `running`일 때만 반영한다.
- 새 생성을 시작할 때 직전 표시 이미지를 `previousImageUri`로 보존한다. 생성이 실패하면 직전 이미지를
  계속 표시하고, 성공하면 새 이미지로 교체한다.
- PNG 생성 성공 후 metadata 저장만 실패한 경우는 `failed`가 아니라 warning을 포함한 `succeeded`로
  표현한다. PNG 보존과 missing metadata 복구 정책은 ADR-012를 따른다.
- picker 표시는 동시에 하나만 열릴 수 있도록 `openPicker: 'model' | 'taesd' | 'lora' | null` 단일
  상태로 표현한다.
- 모델 catalog 로딩과 focus lifecycle은 `useModelCatalog` hook으로 분리한다. 생성 화면은 catalog를
  직접 읽는 세부 절차 대신 목록, 오류와 reconciliation callback만 조정한다.
- reducer와 reconciliation 규칙은 React Native renderer 없이 실행되는 단위 테스트로 검증한다.

이 결정은 ADR-005의 “화면이 상태와 이벤트 orchestration을 담당한다”는 경계를 구체화하며,
네이티브 생성 계약과 결과 보존 정책은 각각 ADR-007과 ADR-012를 변경하지 않는다.

## Alternatives Considered

### 독립적인 `useState` 유지

각 control을 직접 연결하기는 쉽지만 생성 시작·성공·실패마다 여러 setter를 함께 갱신해야 한다.
상태 전이 규칙이 event handler에 흩어지고 순서 누락을 타입으로 막을 수 없어 채택하지 않는다.

### draft와 실행 상태를 하나의 reducer로 통합

화면 상태를 한 곳에서 볼 수 있지만 사용자가 계속 편집하는 설정과 비동기 실행 결과의 수명이 다르다.
설정 control 변경이 실행 상태 전이와 결합되고 reducer action 범위가 불필요하게 커져 채택하지 않는다.

### 생성 화면 전체 상태를 Zustand로 이동

화면 전환 후에도 draft를 유지하거나 여러 화면에서 접근해야 한다면 유용하다. 현재 생성 draft와 실행
표시는 생성 화면의 lifecycle에 속하며, 전역 store로 옮기면 ADR-015의 프로세스 전역 작업 잠금과
화면 로컬 UI 상태의 책임이 섞이므로 채택하지 않는다.

### 모델 선택 객체를 catalog 갱신 후에도 그대로 유지

추가 reconciliation이 필요 없지만 삭제된 파일과 변경 전 metadata를 참조할 수 있다. 파일 ID를
안정적인 identity로 사용해 최신 catalog 레코드와 재조정하는 방식을 채택한다.

## Consequences

- 유효한 실행 상태와 전이가 타입에 드러나며 진행 이벤트와 오류가 잘못된 lifecycle에 적용되지 않는다.
- 생성 실패와 metadata 저장 경고가 구분되고, 새 생성 실패가 직전 성공 결과를 지우지 않는다.
- 모델 관리 화면에서 변경·삭제한 리소스가 생성 화면 선택에 다음 focus 시 반영된다.
- `src/app/index.tsx`는 native 호출, 이미지 metadata 저장과 reducer dispatch를 조정하지만 생성 상태
  전이 규칙 자체는 순수 함수로 분리되어 단위 테스트할 수 있다.
- 생성 옵션을 추가할 때 `GenerationDraft` 타입, 초기값, action, UI binding, 생성·metadata 계약을 함께
  갱신해야 한다. 일부만 변경하면 draft와 공개 생성 계약이 어긋날 수 있다.
- 화면 간 draft 유지나 생성 작업의 background 복원이 필요해지면 현재 화면 로컬 reducer의 수명과
  persistence 전략을 별도로 재평가해야 한다.
