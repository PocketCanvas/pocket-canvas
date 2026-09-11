# ADR-026: Android OpenCL 컴파일과 Qualcomm vendor 디바이스 열거

## Status

Accepted

생성 추론 백엔드는 계속 Vulkan이다. 이 ADR은 OpenCL을 네이티브 모듈에 같이 빌드하고, 기기 GPU가 보이는지만 확인한 범위다.

## Date

2026-09-11

## Context

Galaxy S20+ Adreno 650에서 Vulkan params alloc SIGSEGV가 재현된다. `sd1-512-native-v1`의 `verified`는 S26 근거이며 이 실패를 검증 정책으로 가장하지 않는다. → ADR-018, ADR-022

대안으로 ggml OpenCL 백엔드를 검토하려면 먼저 Android NDK 크로스컴파일이 되는지, 그리고 기기에서 OpenCL GPU가 열거되는지를 나눠 확인해야 한다. NDK에는 OpenCL 패키지가 없고, `ggml-opencl`은 `find_package(OpenCL REQUIRED)`와 호스트 Python kernel embed를 요구한다.

## Decision

### 컴파일 환경

- `SD_VULKAN`을 유지한 채 `SD_OPENCL=ON`으로 ggml-opencl을 `libstable_diffusion_bridge.so`에 같이 넣는다.
- Khronos [OpenCL-Headers](https://github.com/KhronosGroup/OpenCL-Headers)와 [OpenCL-ICD-Loader](https://github.com/KhronosGroup/OpenCL-ICD-Loader)를 `stable-diffusion/cpp/` git submodule로 둔다. 검증된 pin은 `v2026.05.29`다.
- NDK `find_package(OpenCL)`를 만족시키기 위해 프로젝트 소유 `stable-diffusion/android/cmake/FindOpenCL.cmake`가 ICD 로더 타깃을 노출한다.
- 커널 embed용 호스트 Python 3가 필요하다. 서브모듈 `ggml-opencl`은 수정하지 않는다.

### 런타임 열거(probe)

- 생성 경로의 `backend=vulkan`은 바꾸지 않는다.
- 임시 native probe는 프로젝트 소유 `OpenCLProbe.cpp`가 소유하고, JNI 진입만 `StableDiffusionBridge.cpp`, Expo 계약은 `StableDiffusionModule`이 담당한다. → ADR-023
- 설정 → 디버그 패널의 **확인**이 `clGetPlatformIDs` → `clGetDeviceIDs(GPU)` → `CL_DEVICE_NAME`만 읽어 화면에 보여 준다. logcat 계약은 이 범위에 넣지 않는다.
- 링크된 Khronos ICD만으로는 폰에서 플랫폼이 없다. Android 12+ `uses-native-library libOpenCL.so`(`required=false`)와 vendor `libOpenCL.so` 절대 경로 `dlopen`으로 기기 구현을 연다.

### Qualcomm OpenCL 관례

경로에 SoC 이름이나 Adreno 번호를 넣지 않는다. Qualcomm Android 보드는 Treble 이후 64비트 vendor 파티션에 `libOpenCL.so`를 두는 관례가 반복된다.

- Oreo+ 일반 위치: `/vendor/lib64/libOpenCL.so`
- 이전 위치: `/system/vendor/lib64/libOpenCL.so`
- 앱이 열려면 `/vendor/etc/public.libraries.txt`에 `libOpenCL.so`가 있고, targetSdk 31+면 매니페스트 `uses-native-library`가 필요하다. → [AOSP native library namespaces](https://source.android.com/docs/core/permissions/namespaces_libraries), [uses-native-library](https://developer.android.com/guide/topics/manifest/uses-native-library-element)

이 파일은 Snapdragon 820 문서, msm8998 / SM8750 proprietary 목록, llama.cpp·llama.rn Android OpenCL 안내에도 나타난다. S20+(SM8250)에서 같은 경로가 열린 것은 그 관례의 한 실측이다.

## Alternatives Considered

### 패키지 Khronos ICD만으로 런타임 열거

컴파일 링크에는 필요하지만, ICD는 `/system/vendor/Khronos/OpenCL/vendors`의 `.icd` 목록을 찾는다. 갤럭시에는 그 목록이 없어 `clGetPlatformIDs`가 `-1001`(`CL_PLATFORM_NOT_FOUND_KHR`)을 반환한다. APK의 `libOpenCL.so`가 vendor 구현을 가린다. 채택하지 않는다.

### `android_load_sphal_library`만 사용

일부 기기에서 vendor 네임스페이스 우회에 쓰인다. S20+에는 `libvndksupport.so`가 없어 실패했다. vendor 절대 경로 `dlopen`이 성공했으므로 필수 경로로 두지 않는다.

### 생성 백엔드를 즉시 OpenCL로 전환

열거는 성공해도 ggml 추론 성공이 아니다. llama.cpp도 A6xx 폰 드라이버/컴파일러는 OpenCL 백엔드가 실패하기 쉽다고 적는다. S20+ Adreno 650이 여기 해당할 수 있다. 생성 계약은 후속 ADR로 둔다.

## Consequences

- Android 모듈 빌드에 ggml-opencl 심볼과 `NEEDED libOpenCL.so`가 들어간다.
- Galaxy S20+ 실측: 링크된 ICD는 `-1001`, `/vendor/lib64/libOpenCL.so`와 `/system/vendor/lib64/libOpenCL.so`는 `QUALCOMM Snapdragon(TM)` / `QUALCOMM Adreno(TM)`.
- 디바이스 이름은 칩 번호를 포함하지 않는 Qualcomm 표시다. Adreno 650 부정이 아니다.
- 모든 퀄컴 폰이 OpenCL을 켜 두지는 않는다. OEM이 드라이버를 빼거나 `public.libraries.txt`에 올리지 않으면 `dlopen`이 거절된다.
- 최신 보드는 `libOpenCL.so`가 로더이고 `libOpenCL_adreno.so`가 구현인 경우가 있다.
- Mali·PowerVR·Xclipse는 다른 `.so` 이름을 쓴다. 이 ADR의 vendor 경로는 Qualcomm 관례다.
- 이후 생성에 vendor OpenCL을 쓰려면 APK에 ICD `libOpenCL.so`를 넣지 않는 쪽을 검토해야 한다. 지금 생성은 Vulkan이다.

## References

- [ADR-002](ADR-002-vulkan-ndk-build.md)
- [ADR-018](ADR-018-model-descriptor-memory-policy-resolution.md)
- [ADR-023](ADR-023-native-module-responsibility-split.md)
- [llama.cpp OpenCL](https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENCL.md)
- `docs/troubleshooting.md`의 OpenCL 연결 실패 항목
