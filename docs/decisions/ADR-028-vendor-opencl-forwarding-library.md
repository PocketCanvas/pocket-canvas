# ADR-028: ggml OpenCL을 vendor libOpenCL.so로 전달

## Status

Accepted

이 ADR은 [ADR-027](ADR-027-selectable-generation-backend.md)의 “패키지 Khronos ICD + `OCL_ICD_FILENAMES`” 런타임 연결을 대체한다. 설정에서 Vulkan/OpenCL을 고르는 생성 계약, mmap-only OpenCL 경로, 실패 후 재시도 없음은 ADR-027을 유지한다.

## Date

2026-09-11

## Context

S20+에서 설정 OpenCL 생성은 `backend 'opencl' was not found`로 `new_sd_ctx`가 실패했다. `sd_list_devices`는 Vulkan0(Adreno 650)과 CPU만 보여 주었고 OpenCL 디바이스는 없었다.

probe는 vendor `/vendor/lib64/libOpenCL.so`를 `dlopen`해 QUALCOMM Adreno를 확인한다. ggml-opencl은 링크된 `clGetPlatformIDs`를 쓴다. APK의 Khronos ICD는 `/etc/OpenCL/vendors`를 찾고, 갤럭시에는 그 목록이 없어 플랫폼이 0개다.

ADR-027은 `OCL_ICD_FILENAMES`로 vendor 경로를 ICD에 넘겼다. Qualcomm `libOpenCL.so`는 보통 구현/로더이며 ICD vendor 진입점(`clIcdGetPlatformIDsKHR`)이 아니다. ICD가 그 파일을 vendor로 열지 못하면 ggml은 여전히 OpenCL을 못 본다. 실측이 그 실패와 맞았다.

APK에서 ICD를 빼고 `DT_NEEDED libOpenCL.so`를 vendor에 맡기면, OpenCL이 없는 기기에서 `libstable_diffusion_bridge.so` 로드가 실패해 Vulkan 생성까지 깨진다.

## Decision

- 런타임 `libOpenCL.so`는 Khronos ICD가 아니라 프로젝트 소유 `OpenCLForward.cpp`다.
- 이 라이브러리는 `/vendor/lib64/libOpenCL.so`, `/system/vendor/lib64/libOpenCL.so`, 필요하면 sphal `libOpenCL.so`를 `dlopen`한 뒤 ggml이 쓰는 OpenCL API를 `dlsym`으로 전달한다.
- Khronos OpenCL-Headers는 컴파일에만 쓴다. `OpenCL-ICD-Loader` 서브모듈은 유지하되 Android CMake에서 빌드하지 않는다. `ggml-opencl`은 수정하지 않는다.
- vendor를 못 열면 `clGetPlatformIDs`가 `-1001`을 반환한다. 앱 `libOpenCL.so` 자체는 로드되므로 Vulkan 생성은 유지된다.
- SoC 이름이나 Adreno 번호를 경로에 넣지 않는다. 매니페스트 `uses-native-library libOpenCL.so required=false`는 유지한다.
- 열거 성공은 생성 성공이 아니다. A6xx에서 커널 컴파일/추론이 실패할 수 있다.

## Alternatives Considered

### `OCL_ICD_FILENAMES` 유지

구현은 작지만 S20+에서 ggml 장치 목록에 OpenCL이 없었다. ICD vendor 프로토콜에 의존하므로 채택하지 않는다.

### APK에서 libOpenCL.so를 제거하고 vendor NEEDED에 의존

OpenCL이 있는 퀄컴 기기에는 단순하다. OpenCL이 없는 기기에서 네이티브 모듈 로드가 실패한다. 채택하지 않는다.

### ggml-opencl을 vendor `dlopen`으로 수정

서브모듈 수정 금지 규칙과 어긋난다. 프로젝트 소유 전달 라이브러리가 같은 효과를 낸다.

## Consequences

- S20+에서 링크된 `clGetPlatformIDs`가 vendor와 같아지면 `[vulkan] devices=`에 OpenCL 항목이 나타나고, `backend=opencl` 생성이 컨텍스트 생성까지 진행될 수 있다.
- 그 다음 실패는 ggml 커널 컴파일, A6xx 드라이버, 메모리다. 검증 정책으로 가장하지 않는다.
- 설정 디버그 probe의 “linked libOpenCL.so” 구간은 이제 전달 라이브러리다. vendor 직접 `dlopen` 구간은 비교용으로 유지한다.

## References

- [ADR-026](ADR-026-android-opencl-compile-and-vendor-probe.md)
- [ADR-027](ADR-027-selectable-generation-backend.md)
