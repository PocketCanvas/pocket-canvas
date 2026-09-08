## 변경 요약

- 변경 목적과 사용자 또는 개발자에게 미치는 영향을 적어 주세요.
- 순수 리팩터링인지 observable behavior 변경인지 명시해 주세요.

## 네이티브 책임 확인

네이티브 변경이 없다면 이 절은 해당 없음으로 표시할 수 있습니다.

- [ ] upstream `stable-diffusion/cpp/stable-diffusion.cpp/`를 수정하지 않았습니다.
- [ ] 의도적인 `ggml-vulkan/CMakeLists.txt` local modification을 보존했습니다.
- [ ] JNI 진입점·실행 순서·native 자원 수명만 `StableDiffusionBridge.cpp`에 두었습니다.
- [ ] sampler/upscaler, 메모리 정책, 로그 수집, breadcrumb/Vulkan 진단, callback 변경을 각각 소유 C++ 모듈에 두었습니다.
- [ ] Kotlin 변경은 API 계약, lifecycle, 이벤트, 실행 큐, Android 저장소 또는 종료 보고서 책임 안에 있습니다.
- [ ] Kotlin과 C++ 파일을 기계적으로 1:1 대응시키지 않았습니다.
- [ ] 새 프로젝트 소유 `.cpp` 파일이 있다면 Android CMake target에 추가했습니다.

세부 소유권은 [ADR-023](../docs/decisions/ADR-023-native-module-responsibility-split.md)을 따릅니다.

## 검증

- [ ] `npm run test:model-files`
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `cd stable-diffusion && npm run build` (`stable-diffusion/src/` 변경 시 필수)
- [ ] `cd android && .\gradlew.bat :stable-diffusion:assembleDebug` (Android/Kotlin/C++ 변경 시)

## 범위 밖

- 이번 변경에서 의도적으로 다루지 않은 사항이나 후속 작업을 적어 주세요.
