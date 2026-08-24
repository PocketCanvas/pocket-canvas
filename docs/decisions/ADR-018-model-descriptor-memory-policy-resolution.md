# ADR-018: 모델 기술자 기반 지능형 메모리 정책

## Status

Accepted

## Date

2026-08-25

## Context

Pocket Canvas가 다루는 모델은 SD 1.5, SDXL 계열과 각각의 float·Q4·Q8 등으로 늘어나고 있다. 모델 이름과 양자화 타입의 모든 조합을 profile 이름으로 열거하면 새 저장 타입이나 향후 모델 family가 추가될 때 정책 경우의 수가 폭발한다. 반대로 검증된 모델만 허용하면 사용자가 임의 checkpoint와 LoRA를 실행할 수 있다는 앱의 자유도를 해친다.

Galaxy S26 실기기에서는 다음 근거를 확보했다.

- SDXL Turbo Q4 768×768은 내장 VAE decode에 48×48, overlap 0.50 tiling을 적용하면 연속 생성에 성공했다. 상세 수치는 ADR-017에 기록되어 있다.
- SDXL Turbo float 512×512은 diffusion flash attention만 사용했을 때 sampling 시작 후 프로세스가 종료되었다.
- 같은 모델과 workload에서 flash attention과 `params_backend=*=cpu`를 함께 사용하면 3회 연속 생성에 성공했고 품질도 정상이었다. 전체 시간은 약 175~203초였다.
- SDXL Turbo float 768×768 시도는 기기 발열과 장시간 시스템 응답 불능을 유발했다. 그러나 현재 단계에서 이 관찰만으로 사용자 요청을 사전 거절하는 정책을 확정하지 않는다.

메모리 정책은 UI에 노출하지 않는 하드웨어 실행 정책이어야 한다. 사용자가 지정한 sampler, steps, 해상도 등의 생성 설정을 바꾸면 안 되며, 실패 뒤 조건을 변경해 재시도하는 fallback도 아직 도입하지 않는다. 커스텀 native 동작은 프로젝트 경계에 따라 `StableDiffusionBridge.cpp`가 소유해야 한다.

## Decision

### 모델을 descriptor로 표현

모델 header를 읽어 다음의 직교하는 축을 가진 `ModelDescriptor`를 생성한다.

- `family`: `sd1`, `sdxl`, `unknown` 등. tensor 이름과 shape signature로만 판정하고 증거가 부족하면 `unknown`을 유지한다.
- `variant`: 현재는 `turbo` 또는 `unknown`. GGUF metadata, 원본 파일명, alias 순으로 출처를 별도 기록한다. variant 추정치를 tensor signature와 같은 강도의 증거로 취급하지 않는다.
- `storage`: diffusion, text encoder, VAE, other component별 저장 class, dominant type, tensor 수, 추정 byte와 histogram.

Q4/Q5/Q8은 독립 profile 축이 아니라 실제 block layout으로 추정한 component byte cost로 정규화한다. 따라서 SDXL Q8처럼 실험하지 않은 조합도 새 model whitelist 없이 보수 정책의 입력으로 사용할 수 있다. 아직 구현·검증하지 않은 family의 자동 판별 규칙은 미리 추가하지 않는다.

### descriptor와 workload를 C++에서 합성

TypeScript는 저장 파일을 검사해 descriptor를 만들고 Kotlin은 enum·수치 계약을 검증해 JNI로 전달한다. `StableDiffusionBridge.cpp`는 descriptor와 해상도, TAESD, Hires, LoRA 여부를 포함한 workload를 받아 다음 우선순위로 하나의 실행 정책을 합성한다.

1. `verified`: 실기기에서 확인된 정확한 조합에 versioned policy를 적용한다.
2. `conservative`: 정확한 조합 증거가 없지만 component memory cost와 architecture 조건으로 안전 쪽 설정을 합성한다.
3. `native-default`: 근거가 부족하면 upstream 기본 동작을 보존한다.

초기 정책은 다음과 같다.

- 검증된 SDXL Turbo float 512² plain generation: diffusion flash attention 활성화, parameter backend `*=cpu`.
- 검증된 SDXL Turbo Q4 768² 내장 VAE: 48×48, overlap 0.50 VAE tiling.
- 보수적 sampling: SDXL이며 diffusion이 float/Q8 또는 추정 크기가 큰 경우 flash attention과 `*=cpu`를 함께 사용.
- 보수적 decode: SD1/SDXL AutoEncoderKL, 768² 이상, TAESD·Hires 미사용이면 48×48, overlap 0.50 tiling.

sampling과 decode 결정은 독립적으로 합성한다. 이 구조를 통해 예를 들어 미검증 SDXL Q8은 큰 diffusion component에는 CPU 공유 정책을, 고해상도 내장 VAE에는 tiling을 함께 받을 수 있다. 이는 성공 보장이 아니라 현재 증거에서 도출한 보수적 실행 계획이며 로그에서 `conservative`로 명확히 구분한다.

정책은 사용자 입력을 변경하지 않고 UI에도 노출하지 않는다. 실패 후 자동 fallback과 고위험 조합의 사전 거절은 도입하지 않는다. 향후 실제 실패 복구 또는 거절 정책이 필요하면 별도 UX·운영 결정을 거쳐 새 ADR로 추가한다.

### 관측 가능성

요청당 로그에 다음을 기록한다.

- `[model]`: family와 evidence, variant와 evidence, diffusion storage와 추정 byte, VAE architecture.
- `[settings]`: `memory_source`, versioned `memory_policy`, `diffusion_fa`, `params_backend`, `vae_tiling`.

이 로그는 정책이 활성화되었는지뿐 아니라 어떤 입력 근거로 verified/conservative/default가 선택되었는지 확인하기 위한 계약이다.

## Alternatives Considered

### 모델명별 policy whitelist

검증된 인기 모델에는 단순하지만 이름 변경과 custom checkpoint에 취약하고 storage 조합마다 profile이 증가한다. 앱의 자유도와 확장성에 맞지 않아 채택하지 않았다.

### 검증된 조합에만 최적화 적용

오탐은 줄지만 Q8이나 custom checkpoint처럼 정확히 실험하지 않은 모델은 이미 얻은 안전 근거를 전혀 활용하지 못한다. 검증 정책과 보수 정책의 source를 분리하는 쪽을 선택했다.

### 모든 SDXL에 동일 설정 적용

구현은 간단하지만 component 크기, storage, workload 차이를 무시한다. descriptor 기반 합성보다 과도하며 정책 근거를 설명하기 어렵다.

### 고위험 조합 사전 거절

심각한 시스템 응답 불능을 예방할 수 있지만 정책 구축 초기에는 거짓 거절이 앱의 핵심 자유도를 크게 제한한다. 현재는 채택하지 않고 관측 데이터만 남긴다.

### 실패 후 자동 fallback

성공률을 높일 수 있지만 사용자 설정을 암묵적으로 변경하고 프로세스 종료형 OOM에서는 안정적인 재시도를 보장하지 못한다. 명시적 요구에 따라 도입하지 않는다.

## Consequences

- 새 Q 타입은 모델별 profile을 추가하지 않고 storage byte 추정으로 기존 보수 정책에 참여할 수 있다.
- 검증된 실험값과 일반화한 보수 설정이 로그와 policy source에서 구분된다.
- 모르는 모델을 억지로 분류하지 않으므로 최적화가 적용되지 않는 false negative가 있을 수 있지만, 잘못된 family 정책을 적용하는 false positive를 줄인다.
- Turbo 판별은 tensor만으로 확정하기 어려워 metadata·원본 파일명·alias provenance에 의존한다.
- 보수 정책은 성공 보장이 아니다. 새 기기·모델·해상도의 실험 결과에 따라 threshold와 exact policy를 versioned하게 보정해야 한다.
- ADR-017의 VAE 실험 근거와 48×48 선택은 유지하지만, 기존 단일 VAE profile 전달 구조와 로그 계약은 이 ADR의 descriptor/resolver 구조로 확장된다.
