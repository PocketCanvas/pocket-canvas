# ADR-022: 생성 크래시 보고서 스키마

## Status
Accepted

ADR-021의 재실행 JSON 덤프(`last-interrupted.json`, `[diagnostic] interrupted {JSON}`)를 대체한다. 죽기 전 단계 진입 `fsync`와 다음 실행 합치는 파이프는 ADR-021을 유지한다.

## Date
2026-09-06

## Context

ADR-021은 프로세스가 사라져도 단계와 Vulkan 정체를 남겼다. 그러나 재실행 로그가 긴 JSON 한 줄이라 읽기 어렵고, 실제 원인 프레임은 Android DEBUG tombstone에만 있어 GitHub tag 실험 빌드·이후 Firebase로 넘어가지 않았다.

Galaxy S20+(API 33) 재현에서 1차 분류는 성공했다. `exit.reason=crash_native`, `status=11`(SIGSEGV), sampling 진입 전 사망. LMK가 아니다. 다만 `getTraceInputStream()`을 `#00 pc` 텍스트로 읽으면 스택이 비어 `topSymbol=null`이 된다. Android 12(API 31)+ native crash trace는 [tombstone protobuf](https://developer.android.com/reference/android/app/ApplicationExitInfo#getTraceInputStream())다.

Firebase SDK는 아직 없다. SDK 이전에도 **한 줄 제목 + 안정된 키 + 짧은 네이티브 스택**이 있는 보고서가 필요하다. ADR-011 성공 로그는 수집 문서가 아니다.

## Decision

### 두 층

1. **breadcrumb** — `filesDir/diagnostics/generation-run.json`. C++가 단계 **진입** 때 덮어쓰고 `fsync`한다. `schemaVersion: 2`, `kind: "breadcrumb"`, `status: "running"`.
2. **generation_crash** — `filesDir/diagnostics/last-crash.json`. 다음 실행의 `consumeInterruptedGeneration`이 breadcrumb + 기기 스냅샷 + `ApplicationExitInfo` + tombstone 파싱 결과를 조립한다. 공용 Expo 큐가 아니라 기본 모듈 큐에서 실행한다.

생성이 JS로 성공·실패를 반환하면 breadcrumb 파일을 삭제한다. `status=running`으로 남으면 다음 실행에서 보고서로 만든다.

### breadcrumb 단계

UI progress는 `loading` / `encoding` / `sampling` / `decoding`을 유지한다. breadcrumb만 세분한다.

| breadcrumb `stage` | 의미 |
|---|---|
| `loading` | `new_sd_ctx` 전후 |
| `lora_apply` | LoRA가 있을 때 `generate_image()` 직전. 런타임 LoRA Vulkan alloc |
| `text_encoding_prepare` | LoRA 없음. 텍스트 인코딩 준비 |
| `text_encoding_params` | CLIP/conditioner params를 백엔드에 올리는 구간. LoRA 없는 S20+ SIGSEGV의 기본 마지막 단계 |
| `text_encoding_compute` | params alloc 성공 후 CLIP compute |
| `sampling` / `decoding` | 기존 progress와 동일 |

### 보고서 필드

- `title`: 한 줄. 예: `native SIGSEGV at ggml_backend_buft_alloc_buffer`
- `breadcrumb.backend`: 실제 선택값 `{ diffusion, textEncoder, vae, textEncoderParams }`. `paramsBackend=default`를 그대로 남기지 않는다. compute는 Vulkan, `*=cpu`면 `textEncoderParams=cpu`
- `breadcrumb.nativeTail`: 네이티브 로그 링버퍼 최대 40줄. 앱 파일 경로는 `<app-file>`. 전체 upstream 로그·prompt는 넣지 않는다
- `device`: 제조사, 모델, SoC, RAM, SDK
- `exit.reason`, `exit.status`, `exit.signalName`
- `exit.signal`: `{ number, name, code, codeName, faultAddress }` — tombstone Signal. `faultAddress=0x0` + `codeName=SEGV_MAPERR`는 null 접근 가설을 강하게 한다
- `stack.topSymbol`
- `stack.frames[]`: `{ library, pc, relPc, symbol, symbolOffset, buildId }` 최대 16개. `relPc`와 `buildId`는 llvm-addr2line·릴리즈 대응용. `pc`만으로는 ASLR 때문에 부족하다

prompt, 모델 경로, alias, seed, 출력 URI는 금지한다. family·해상도·preset·memory policy·Vulkan 장치/API/드라이버는 허용한다.

### tombstone 파싱

API 31+ `ApplicationExitInfo.getTraceInputStream()`은 protobuf다. `protobuf-javalite`를 넣지 않는다. Firebase 등과 버전 충돌이 난다. `TombstoneTraceParser`가 AOSP `tombstone.proto` 필드만 손으로 디코드한다. 텍스트 tombstone이면 fallback한다. API 30은 종료 사유만 있고 스택이 비어 있을 수 있다. 순환 버퍼가 덮이면 stream은 null일 수 있다.

`pssKb`/`rssKb`가 0이어도 수집 실패로 보지 않는다. native crash 기록은 메모리 스냅샷을 보장하지 않는다.

### 확인 경로

logcat은 JSON 덤프가 아니라 한 줄이다.

```text
[crash] native SIGSEGV at ggml_backend_buft_alloc_buffer stage=text_encoding_params exit=crash_native vulkan=1.1.128 family=sd1 lora=0 symbol=ggml_backend_buft_alloc_buffer
```

설정 화면 디버그 패널은 `last-crash.json`을 읽고, 없으면 미완성 breadcrumb를 보여 준다. 제품 기능이 아니라 실험 확인용이다. USB는 `adb logcat -s StableDiffusionBridge:I`와 `run-as … cat files/diagnostics/last-crash.json`으로 확인한다.

Firebase 전송은 이 파일을 올리는 후속 작업이다. iOS 모듈 스텁에 크래시 API를 넣지 않는다. Android만 구현한다. JS는 네이티브 함수가 없으면 `null`을 반환한다.

## Alternatives Considered

- 플랫 JSON 덤프 유지: 필드는 있지만 제목과 스택이 없어 Firebase custom keys로 쓰기 어렵다.
- 전체 tombstone 첨부: 용량과 경로 유출 위험이 크다.
- `protobuf-javalite`로 tombstone.proto 생성: 디코드는 쉽지만 Firebase 등과 의존성 충돌이 난다.
- UI stage에 `lora_apply` / `text_encoding_*` 추가: 생성 화면 진행 표시를 바꾸지 않기 위해 breadcrumb만 세분한다.
- encoding 내부를 tokenize 단위로 더 쪼개기: 서브모듈 로그가 부족하고 이번 SIGSEGV 분류에 필요 없다.
- 생성 중 크래시 로그를 Firebase로 스트리밍: 죽은 프로세스에는 네트워크가 없다.

## Consequences

- USB와 이후 Firebase가 같은 `title` / `stack.topSymbol` / `exit.signal` / `relPc`를 본다.
- 예전 `last-interrupted.json` 이름은 쓰지 않는다. 디스크에 남은 파일은 무시한다.
- `sd1-512-native-v1`의 `verified`는 S26 근거이며 S20+ Adreno 650 Vulkan alloc 실패를 검증된 정책으로 가장하지 않는다.
- 스택이 채워진 뒤에야 ggml-vulkan / 드라이버 / JNI 중 어디서 SIGSEGV가 났는지 말할 수 있다. Vulkan API 버전 숫자만으로 단정하지 않는다.

## References

- [ApplicationExitInfo.getTraceInputStream](https://developer.android.com/reference/android/app/ApplicationExitInfo#getTraceInputStream())
- [tombstone.proto](https://android.googlesource.com/platform/system/core/+/master/debuggerd/proto/tombstone.proto)
- [ADR-011](ADR-011-generation-request-logging.md)
- [ADR-021](ADR-021-crash-surviving-generation-diagnostics.md)
