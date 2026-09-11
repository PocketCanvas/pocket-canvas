# ADR-027: 설정 CPU는 ggml CPU 연산 백엔드

## Status

Accepted

이 ADR은 [ADR-026](ADR-026-settings-params-backend-override.md)의 설정 `CPU` 의미를
개정한다. 설정 탭 위치, Vulkan 기본값, MemoryPolicy 비변경, 자동 fallback 금지는 유지한다.

## Date

2026-09-11

## Context

ADR-026은 S20+에서 Vulkan 파라미터 할당 SIGSEGV를 우회하려고 `params_backend=*=cpu`만
강제하고 `ctx_params.backend`는 `"vulkan"`으로 남겼다. 실기기 결과는 다음과 같다.

- 베이스 모델 가중치는 RAM으로 내려갔다 (`VRAM 0 / RAM 1744MB`).
- LoRA가 있으면 `lora_apply`의 `LoraModel::load_from_file`이 다시
  `ggml_backend_buft_alloc_buffer`에서 `fault addr 0x0` SIGSEGV.
- LoRA를 빼면 CLIP `get_learned_condition` → `GGMLRunner::execute_graph` →
  `SegmentWeightPipeline::segment_start` → `prepare_params`에서 같은 심볼로 죽는다.

미리 올린 가중치만 CPU로 옮겨도, 그래프 실행이 Vulkan 버퍼를 또 할당한다. 파라미터
우회만으로는 Adreno 650의 이 구멍을 피하지 못한다. OpenCL은 이미 불가였다.

## Decision

- 설정 `CPU`는 `ctx_params.backend = "cpu"`와 `params_backend=*=cpu`를 함께 적용한다.
  로딩·인코딩·샘플링·디코드가 ggml CPU 백엔드를 탄다.
- 설정 `Vulkan`은 ADR-026과 같이 MemoryPolicy가 `params_backend`을 정하고 compute는
  `"vulkan"`이다.
- 적용은 계속 `StableDiffusionBridge.cpp`가 한다. `MemoryPolicy`의 `verified` 프로파일은
  바꾸지 않는다. 실패 후 자동 fallback은 없다.
- breadcrumb `backend.diffusion` / `textEncoder` / `vae`는 실제 compute backend를 기록하고,
  `[settings]`에 `backend=`을 남겨 CPU 선택이 먹었는지 확인한다.
- 진단용 Vulkan 장치 조회(`query_vulkan_identity`)는 유지한다. 추론 백엔드가 아니라
  기기 식별이다.

## Alternatives Considered

### 파라미터 CPU를 유지한 채 세 번째 선택지 추가

실험 스위치가 늘어나고, 이미 실패한 경로를 UI에 남긴다. 설정 `CPU`의 의미를 바꾸는
편이 맞다.

### CLIP만 CPU, diffusion은 Vulkan

모듈별 backend 문자열은 가능하지만, CLIP compute에서 이미 Vulkan alloc으로 죽었다.
S20+ 검증 목표는 연산이 끝나는지이므로 전체 CPU가 더 작은 다음 실험이다.

## Consequences

- S20+에서 `[settings] backend=cpu params_backend=*=cpu`와 breadcrumb
  `backend.diffusion=cpu`로 적용을 확인한다.
- CPU 기능 기준은 Galaxy S20+ SD1 Q4 + LCM-LoRA, 256×256, 2 steps다. 512×512 CPU는
  sampling 중 사용자가 시간 때문에 중지했으며, SIGSEGV가 아니다.
- 이 결과를 `MemoryPolicy`의 `verified`로 올리지 않는다. 256×256은
  `memory_source=native-default`였다.

## Validation

Galaxy S20+(`SM-G986N`, Android 13, Adreno 650)에서 설정 CPU로 SD1 Q4 + LCM-LoRA
생성이 완료됐다. `[settings] backend=cpu params_backend=*=cpu`,
`[request] complete success=1`.

| 항목 | 값 |
|---|---|
| 해상도 | 256×256 |
| Sampling | LCM, 2 steps, CFG 1.0 |
| LoRA | 1 |
| memory_source | native-default |
| loading | 1.44s |
| encoding | 12.49s |
| sampling | 341.84s |
| decoding | 512.85s |
| png_write | 0.07s |
| 전체 | 869.13s |

같은 기기·백엔드의 512×512 LCM 4 steps / 2 steps 시도는 sampling 진입 후
`user_requested`로 끊겼다. 크래시 보고서의 `ggml_backend_buft_alloc_buffer` SIGSEGV와
섞지 않는다.

## References

- [ADR-018](ADR-018-model-descriptor-memory-policy-resolution.md)
- [ADR-022](ADR-022-generation-crash-report-schema.md)
- [ADR-026](ADR-026-settings-params-backend-override.md)
