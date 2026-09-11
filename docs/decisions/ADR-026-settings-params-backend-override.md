# ADR-026: 설정 탭의 파라미터 백엔드 진단 스위치

## Status

Superseded by [ADR-027](ADR-027-ggml-cpu-inference-backend.md)

설정 탭 위치와 Vulkan 기본값, MemoryPolicy 비변경은 유지한다. 설정 `CPU`의 의미는
파라미터만 CPU가 아니라 ggml CPU 연산 백엔드로 개정한다.

## Date

2026-09-11

## Context

Galaxy S20+(Adreno 650)에서 SD1 512 생성은 `text_encoding_params` 단계의 Vulkan
파라미터 버퍼 할당에서 SIGSEGV로 죽는다. CLIP compute와 sampling에는 도달하지 않는다.
같은 기기에서 OpenCL 경로는 별도 실험으로 불가였다. `sd1-512-native-v1`의 `verified`는
S26 근거이며, 이 죽음을 검증 정책 실패로 가장하거나 서브모듈을 수정하지 않는다.
→ ADR-018, ADR-022, ADR-025

연산(ggml compute)이 Vulkan에서 사는지는 아직 관측되지 않았다. 전체 ggml CPU 백엔드는
다음 실험 단계로 미루고, 먼저 `params_backend=*=cpu`만 강제해 파라미터 할당을 CPU로
옮긴 뒤 연산이 진행되는지를 본다.

이 스위치는 일반 사용자 호환 기능이 아니라 개발자 진단용이다. 생성 탭 draft에 넣으면
실행 설정과 입력 중인 생성 옵션이 섞인다. 테마와 같이 앱 전역으로 유지되는 실행 선호가
맞다.

## Decision

- 설정 화면에 **추론 백엔드** 섹션을 둔다. 선택지는 `Vulkan`과 `CPU`이며 기본값은
  `Vulkan`이다. 값은 Zustand persist로 앱 재시작 후에도 유지한다.
- `Vulkan`은 현재와 같이 `MemoryPolicy`가 `params_backend`를 정한다.
- `CPU`는 `ctx_params.backend`를 `"vulkan"`으로 유지한 채 `params_backend=*=cpu`만
  강제한다. flash attention과 VAE tiling 등 나머지 정책 결과는 그대로 적용한다.
- 정책 합성은 계속 `MemoryPolicy`가 담당하고, 덮어쓰기는 `StableDiffusionBridge.cpp`가
  적용한다. Kotlin은 `vulkan` / `cpu` 계약만 검증한다.
- 적용 결과는 기존 `[settings]`의 `params_backend`과 breadcrumb의
  `paramsBackend` / `backend.textEncoderParams`로 확인한다. 실패 후 Vulkan→CPU 자동
  fallback은 없다.
- ggml CPU only, OpenCL 빌드/UI, 생성 탭 스위치, `verified` 프로파일 변경은 이번 범위가
  아니다.

## Alternatives Considered

### 생성 탭에 백엔드 선택 두기

생성 직전에 바꾸기 쉽지만 ADR-016의 draft는 prompt·리소스·sampling 입력을 소유한다.
기기 진단용 실행 선호를 draft에 넣으면 카탈로그 재조정과 섞인다. 채택하지 않는다.

### 설정 CPU를 ggml CPU 백엔드로 바로 연결

S20+에서 Vulkan 연산이 막혔는지는 아직 모른다. 파라미터 할당 실패만 우회하는 더 작은
실험이 먼저다. 전체 CPU 추론은 후속 단계로 남긴다.

### MemoryPolicy에 S20+용 verified 프로파일 추가

한 대의 실패를 검증 정책으로 가장하게 된다. ADR-018과 충돌하므로 채택하지 않는다.

### 디버그 패널 안에 숨기기

크래시 로그와 섞이면 실험 중 발견하기 어렵다. 설정 탭의 독립 섹션으로 둔다.

## Consequences

- S20+에서 CPU를 고르면 `[settings] params_backend=*=cpu`가 남아 실험이 먹었는지
  확인할 수 있다.
- UI 이름 `CPU`는 전체 CPU 추론이 아니다. 다음 단계에서 ggml CPU 백엔드를 넣을 때
  선택지 의미를 바꿔야 한다.
- 이미지 metadata에는 이 설정을 아직 넣지 않는다. 실행 진단은 logcat과 breadcrumb가
  담당한다.

## References

- [ADR-016](ADR-016-generation-screen-state-model.md)
- [ADR-018](ADR-018-model-descriptor-memory-policy-resolution.md)
- [ADR-022](ADR-022-generation-crash-report-schema.md)
- [ADR-023](ADR-023-native-module-responsibility-split.md)
- [ADR-025](ADR-025-crash-log-data-minimization.md)
