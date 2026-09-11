# ADR-027: 설정에서 선택하는 생성 백엔드 (Vulkan / OpenCL)

## Status

Accepted

이 ADR은 [ADR-026](ADR-026-android-opencl-compile-and-vendor-probe.md)의 “생성 추론 백엔드는 Vulkan” 계약을 갱신한다. OpenCL 컴파일, vendor probe, 패키지 ICD가 폰에서 `-1001`인 관례는 ADR-026을 유지한다.

패키지 Khronos ICD + `OCL_ICD_FILENAMES` 런타임 연결은 [ADR-028](ADR-028-vendor-opencl-forwarding-library.md)이 대체한다. Vulkan/OpenCL 선택 계약과 OpenCL mmap-only 경로는 유지한다.

## Date

2026-09-11

## Context

ADR-026은 ggml-opencl을 Vulkan과 같이 컴파일하고, Galaxy S20+에서 vendor `libOpenCL.so`로 GPU 이름을 열거했다. 생성 `ctx_params.backend`는 `"vulkan"`으로 고정했다. 열거 성공은 추론 성공이 아니며, A6xx 폰 드라이버는 OpenCL 백엔드에서 실패할 수 있다.

S20+ Adreno 650에서는 검증된 Vulkan 경로가 sampling 진입 전 SIGSEGV를 낼 수 있다. vendor OpenCL 연결이 열린 뒤, 같은 기기에서 **실제 `generate_image`를 OpenCL로 실행**해 볼 필요가 생겼다. 다만 기본 생성을 몰래 OpenCL로 바꾸거나 probe 결과에 따라 자동 전환하면, S26에서 검증된 Vulkan 경로를 잃는다.

패키지 Khronos ICD `libOpenCL.so`는 `/system/vendor/Khronos/OpenCL/vendors`를 찾는다. 갤럭시에는 그 목록이 없어 링크된 `clGetPlatformIDs`가 `-1001`이다. ggml-opencl은 링크된 OpenCL 심볼을 쓰므로, 생성 전에 vendor 구현을 ICD에 알려 주지 않으면 OpenCL 추론은 열거와 달리 바로 실패한다. APK에서 ICD를 빼면 `DT_NEEDED libOpenCL.so`가 없는 기기에서 네이티브 모듈 로드 자체가 실패해 Vulkan 생성까지 깨진다.

Vulkan 메모리 정책(flash attention, `params_backend=*=cpu`, VAE tiling)은 S26 Vulkan 근거이다. OpenCL 경로에 그대로 적용하면 검증되지 않은 조합을 검증 정책으로 가장하게 된다.

## Decision

- 설정 탭에 추론 백엔드 선택 UI를 둔다. 값은 `vulkan` | `opencl`이며 기본값은 `vulkan`이다. 선택은 AsyncStorage에 남아 앱 재시작 후에도 유지된다.
- 생성 화면이 요청을 만들 때 현재 설정값을 `GenerateImageOptions.backend`에 실어 네이티브로 전달한다. native가 설정 저장소를 직접 읽지 않는다.
- Kotlin은 `vulkan` | `opencl`만 허용한다. C++ `GenerationOptions`가 같은 문자열을 upstream `sd_ctx_params_t.backend`로 매핑한다. 알 수 없는 값은 거절하며 다른 백엔드로 재시도하지 않는다.
- 두 경로 모두 `enable_mmap = true`를 유지한다.
- `opencl`을 고르면 ADR-018 `MemoryPolicy`를 적용하지 않는다. flash attention, CPU parameter backend, VAE tiling은 끈다. 로그의 `memory_source`는 `native-default`이다. `vulkan`을 고르면 기존 정책을 유지한다.
- 양자화 JNI는 이번 범위가 아니다.
- 이미지 metadata에는 backend를 넣지 않는다. 생성 의미가 아니라 실행 백엔드이며, 기존 complete 레코드를 깨지 않기 위함이다. 선택값과 적용 결과는 `[settings]`, `[model]`, breadcrumb `backend`에 남긴다.
- 패키지 Khronos ICD는 유지한다. 네이티브 라이브러리 로드와 OpenCL 생성 전에 `OCL_ICD_FILENAMES`를 vendor 경로(`/vendor/lib64/libOpenCL.so`, `/system/vendor/lib64/libOpenCL.so`)로 설정한다. ICD 열거는 프로세스에서 한 번이므로 probe보다 먼저 설정한다. 이 호출은 `OpenCLProbe`가 소유한다.
- probe 성공을 생성 성공으로 취급하지 않는다. OpenCL 로드/생성 실패는 지금과 같이 실패로 반환한다.

## Alternatives Considered

### 기본 생성을 OpenCL로 고정

S20+ 실험에는 빠르지만 S26에서 검증된 Vulkan 경로를 잃는다. 사용자 선택 분기를 채택한다.

### probe 결과에 따라 자동 전환

열거 성공은 ggml 추론 성공이 아니다. ADR-026과 같은 이유로 채택하지 않는다.

### APK에서 Khronos ICD를 제거

vendor `libOpenCL.so`가 있는 기기에서는 ggml가 바로 구현을 쓰지만, OpenCL이 없는 기기에서는 `libstable_diffusion_bridge.so` 로드가 실패한다. ICD를 유지한 채 vendor 파일 목록을 넘기는 쪽을 선택한다.

### OpenCL에도 기존 MemoryPolicy를 적용

구현은 단순하지만 FA·CPU params·VAE tiling은 Vulkan 실기기 근거이다. 이번 실험은 mmap만 적용한다.

### 이미지 metadata에 backend를 필수로 기록

재현에는 유리하지만 ADR-012의 complete 레코드가 기존 사진을 거부하게 된다. 실행 백엔드는 로그·breadcrumb로 남긴다.

## Consequences

- 설정에서 OpenCL을 고르면 생성 계약이 `backend=opencl`을 JNI까지 전달하고, C++가 `ctx_params.backend`를 분기한다.
- vendor 라이브러리가 `cl_khr_icd`를 지원하지 않으면 ICD가 플랫폼을 못 찾고 OpenCL 생성이 실패할 수 있다. 그 경우 패키지 ICD를 vendor 전달 스텁으로 바꾸는 후속 작업이 필요하다. 서브모듈 `ggml-opencl`은 수정하지 않는다.
- OpenCL 추론의 성공·품질·메모리는 아직 검증되지 않았다. S20+ A6xx에서 실패하는 것은 예상 가능한 결과이며 검증 정책으로 가장하지 않는다.
- AGENTS 규칙의 “생성 백엔드는 Vulkan” 문구는 이 ADR의 사용자 선택 계약으로 갱신한다.

## References

- [ADR-018](ADR-018-model-descriptor-memory-policy-resolution.md)
- [ADR-023](ADR-023-native-module-responsibility-split.md)
- [ADR-026](ADR-026-android-opencl-compile-and-vendor-probe.md)
