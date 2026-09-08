# ADR-021: 강제 종료를 넘는 생성 진단 기록

## Status
Accepted

재실행 때 남기는 JSON 문서 형태·파일 이름·logcat 태그는 [ADR-022](ADR-022-generation-crash-report-schema.md)가 대체한다. 단계 진입 `fsync` breadcrumb와 다음 실행 합치는 수집 파이프는 유지한다. `last-interrupted.json`과 `[diagnostic] interrupted`는 쓰지 않는다.

현재 breadcrumb·Vulkan 식별·파일 기록은 C++ `GenerationDiagnostics`, native 로그 tail은 `NativeLogCollector`, 다음 실행의 종료 보고서 조립은 Kotlin `GenerationCrashReporter`가 담당한다. 수집 동작은 유지된다. → ADR-023

## Date
2026-09-06

## Context

S26에서 검증된 생성이 Galaxy S20+에서는 인코딩 이후 sampling 진입 직후 예외 없이 프로세스가 사라질 수 있다. ADR-011의 `[stage]` 로그는 단계가 **끝난 뒤**에만 남으므로, `generate_image()` 안에서 죽으면 마지막 단계가 보이지 않는다. USB logcat만으로는 GitHub tag 실험 빌드 테스터의 죽음을 수집할 수 없고, 프로세스가 죽은 뒤에는 Firebase로도 보낼 수 없다.

프롬프트, 정확한 모델 파일, 경로, alias, seed는 진단에 넣지 않는다. model family와 기기·Vulkan·생성 workload(해상도, steps, preset, memory policy)는 허용한다. Firebase SDK는 이번 범위가 아니다.

## Decision

- 생성 JNI는 앱 저장소 `filesDir/diagnostics/generation-run.json`에 개인정보 없는 JSON을 기록한다. 단계 **진입** 때 `fwrite` + `fflush` + `fsync`를 수행한다. sampling 첫 진입이 핵심이다. sampling step마다 fsync하지 않는다.
- JSON에는 `status`, `stage`, Vulkan 장치/API/드라이버, family, workload, memory policy만 넣는다. prompt, 경로, alias, seed, 출력 URI는 금지한다.
- Vulkan 식별은 submodule이 아니라 `StableDiffusionBridge.cpp`에서 임시 `VkInstance`로 조회한다. 1.1 생성에 실패하면 1.0을 시도한다. 조회 전에 `stage=loading` 기록을 먼저 남겨, 조회 자체에서 죽어도 파일이 남게 한다.
- 생성이 JS로 성공·실패를 반환하면 해당 JSON을 삭제한다. `status=running`인 채로 남으면 다음 실행에서 중단으로 본다.
- 다음 실행의 `consumeInterruptedGeneration`이 파일을 읽고, API 30+에서는 `ActivityManager.getHistoricalProcessExitReasons`로 종료 사유를 붙인 뒤 `diagnostics/last-interrupted.json`에 보관한다. 이 호출은 `nativeOperationQueue`를 쓰지 않는다.
- 앱 시작 시 중단 레코드를 `[diagnostic]`로 남긴다. USB는 `adb logcat -s StableDiffusionBridge:I`로 확인한다. Firebase 전송은 같은 JSON을 올리는 후속 작업이다.

## Alternatives Considered

- ADR-011 성공 로그를 두껍게 하기: sampling 시작 전에 프로세스가 죽으면 여전히 유실되고, 원격 테스터에게 전달되지 않는다.
- 생성 중 Firebase 스트리밍: 죽은 프로세스에는 네트워크가 없다.
- USB 시스템 로그만 수집: S20+ 한 대에는 빠르지만 GitHub tag 실험 릴리즈의 계약이 되지 않는다.
- 이번 슬라이스에 Crashlytics 연결: 수집 계약을 검증하기 전에 동의·PII·심볼 범위가 커진다.

## Consequences

- 정상 생성의 logcat 양은 ADR-011을 유지하되, 단계 진입마다 `[diagnostic]` 한 줄이 추가된다.
- Android 11 미만에서는 종료 사유가 `unavailable`이다. 단계와 Vulkan 필드는 남는다.
- Vulkan 조회용 임시 instance가 ggml 초기화 전에 생성·파괴된다. 드라이버가 이 조회에서 죽으면 레코드는 `vulkanApi=unknown`인 loading 상태로 남는다.
- `last-interrupted.json`은 이후 Firebase 페이로드의 로컬 원본이다. 전송·동의·실험 플래버는 ADR을 추가해 다룬다.

## References

- [ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo)
- [ADR-011](ADR-011-generation-request-logging.md)
- [ADR-015](ADR-015-heavy-operation-coordination.md)
