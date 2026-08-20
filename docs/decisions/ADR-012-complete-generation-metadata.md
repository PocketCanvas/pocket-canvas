# ADR-012: 생성 메타데이터 완전성과 이미지 보존

## Status
Accepted

## Date
2026-08-20

## Context

생성 화면에 네거티브 프롬프트, decoder, 해상도, sampler, CFG, seed와 내장 Hires 설정이 추가됐지만 이미지 저장 타입은 과거 데이터 호환을 위해 여러 필드를 optional로 유지했습니다. 또한 TAESD 선택은 실제 추론에 전달되면서도 metadata에는 기록되지 않았습니다.

프로젝트가 초기 개발 단계이고 기존 앱 데이터가 삭제됐으므로 불완전한 구버전 생성 스키마를 계속 지원할 이유가 없습니다. 다만 오랜 시간이 걸린 PNG는 metadata 인덱스 기록 실패만으로 폐기하면 안 됩니다. 알 수 없는 값을 기본값으로 합성하지 않으면서 사진을 보존할 별도 상태가 필요합니다.

## Decision

- `StoredImageMetadata`는 `complete | missing` 구별된 union으로 저장합니다.
- `complete`는 현재 생성 계약의 모든 옵션을 필수로 저장합니다.
- `missing`은 사진 식별자, 파일명, 생성 시각과 즐겨찾기만 저장하며 생성 옵션 필드를 nullable로 만들지 않습니다.
- decoder는 `{ type: 'vae' }` 또는 `{ type: 'taesd', model }`의 구별된 union으로 기록합니다.
- 저장 필드는 prompt, negative prompt, model, decoder, LoRA와 가중치, width, height, sampling preset, steps, CFG, 실제 seed와 Hires 설정 전체입니다.
- metadata validator는 완전한 최신 레코드와 명시적인 `missing` 레코드만 허용합니다.
- PNG 생성에 성공하면 `images/meta.json` 기록 실패 여부와 관계없이 결과를 보존하고 UI에 노출합니다.
- `meta.json`에 없는 고아 PNG는 디렉터리 스캔으로 찾고 `missing` 항목으로 복구합니다.
- 복구 항목에는 알 수 없는 prompt, model과 생성 옵션을 추정하거나 기본값으로 합성하지 않습니다.
- 구버전 스키마, schema version 분기와 nullable 호환 계층은 도입하지 않습니다.

## Alternatives Considered

### 구버전과 최신 버전을 함께 지원

- 기존 사진을 보존할 수 있지만 초기 개발 데이터는 이미 삭제됐습니다.
- 버전별 validator와 화면 분기가 계속 남으므로 현재 단계에서는 비용이 이점보다 큽니다.

### 새 필드를 optional로 유지

- 코드 변경은 작지만 앱 전역에서 생성 설정의 부재를 계속 처리해야 합니다.
- 새로 생성한 이미지에도 불완전한 metadata가 들어갈 수 있어 채택하지 않습니다.

### metadata 실패 시 PNG 삭제

- 모든 히스토리 항목의 생성 설정을 완전하게 유지할 수 있습니다.
- 오래 걸려 만든 이미지가 보조 인덱스 기록 실패 때문에 사라지므로 채택하지 않습니다.

### 고아 PNG에 기본 설정을 합성

- PNG를 히스토리에 다시 노출할 수 있습니다.
- 실제 생성 조건을 알 수 없으므로 metadata가 사실과 달라질 수 있어 채택하지 않습니다.

## Consequences

- `complete` 히스토리 항목은 모든 현행 생성 설정을 신뢰하고 표시할 수 있습니다.
- `missing` 항목은 사진을 정상적으로 탐색·공유·삭제할 수 있고 상세 화면에는 생성 정보가 없음을 표시합니다.
- TAESD를 사용한 이미지와 기본 VAE 이미지를 구분할 수 있습니다.
- metadata 저장 장애가 발생해도 생성된 PNG는 보존되며 다음 히스토리 로딩에서 복구됩니다.
- 생성 옵션을 추가할 때 metadata 입력, validator, 생성 화면 연결, 상세 화면과 테스트를 같은 변경에서 갱신해야 합니다.
- ADR-007의 PNG 보존 우선 원칙과 ADR-008의 고아 PNG 복구 정책을 유지하되, 복구 항목을 `missing` 타입으로 명시합니다.
