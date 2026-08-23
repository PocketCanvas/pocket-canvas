# ADR-014: Android 온디바이스 스트리밍 양자화

## Status
Accepted

## Date
2026-08-22

## Context

Pocket Canvas는 사용자가 가져온 SafeTensors 또는 GGUF 모델을 Android 기기 안에서 실행한다.
원본 모델을 외부 환경에서 미리 변환하도록 요구하지 않고, 앱이 자체적으로 더 작은 GGUF를
생성해 기존 mmap 추론 경로에서 사용할 수 있어야 한다.

`stable-diffusion.cpp`의 공개 `convert()` API는 모델 전체를 한 번에 적재하지 않고 tensor별로
읽기, 변환, 출력 기록을 수행한다. 변환 입력 자체에는 mmap을 사용하지 않지만 결과 GGUF는
기존 `enable_mmap` 추론 경로에서 사용할 수 있다. 변환은 오래 걸리고 큰 임시 파일을 만들 수
있으므로 원본 보존, 중단 파일 정리와 네이티브 작업 직렬화가 필요하다.

## Decision

- 공개 계약에 `quantizeModel(inputUri, outputUri, type)`을 추가하고 TS → Kotlin → JNI →
  `StableDiffusionBridge.cpp`에서 upstream `convert()`를 호출한다.
- 앱에 노출하는 타입은 공식 Stable Diffusion 양자화 문서의 `q8_0`, `q5_0`, `q5_1`,
  `q4_0`, `q4_1`과 ADR-003에서 Android 생성이 검증된 `q4_K`로 제한한다.
- 기본 선택은 `q4_K`이다. 더 낮은 bit와 IQ 계열은 enum 존재만으로 앱 지원으로 간주하지 않고
  품질과 Vulkan 실기기 실행을 검증한 뒤 별도 추가한다.
- Kotlin과 C++ 양쪽에서 타입 allowlist를 검사한다. Kotlin은 canonical path가 앱 `filesDir`
  내부인지, 원본이 실제 파일인지, 출력이 원본과 다르고 아직 존재하지 않는지 검증한다.
- `.quantizing-<id>.gguf`에 먼저 출력하고 GGUF header를 다시 검사한 뒤 최종 파일로 이동한다.
  인덱스 기록 실패 시 새 GGUF를 제거하며, 다음 모델 목록 로딩에서 중단된 임시 파일을 정리한다.
- 원본 모델은 삭제하거나 변경하지 않는다. 결과는 새 모델 레코드로 등록하고 `quantization`과
  `sourceModelId`를 기록한다.
- 생성과 양자화는 같은 전역 upstream 콜백과 큰 메모리를 사용하므로 네이티브 mutex로 동시에
  하나만 실행한다. 다른 작업이 진행 중이면 새 요청을 즉시 거절한다.
- upstream 변환 루프의 `sd_set_progress_callback()`이 완료 tensor 수와 전체 tensor 수를
  전달하므로 모델 관리 화면에 tensor 기준 진행률을 표시한다. tensor마다 크기와 처리 비용이
  달라 시간에 선형인 진행률이나 정확한 ETA로 해석하지 않는다.
- 변환 callback은 upstream worker thread에서 호출되므로 JNI bridge가 해당 thread를 JVM에
  attach하고 global module reference로 Expo event를 전달한다. 작업 종료 후 callback과 JNI
  reference를 정리한다.
- upstream에 취소 계약은 없으므로 취소와 백그라운드 작업 지속은 제공하지 않는다.

## Alternatives Considered

### 변환 입력도 mmap으로 처리

현재 upstream `convert.cpp`는 `process_model_files(false, false)`로 mmap을 끈다. upstream
내부 구현을 수정하면 프로젝트의 submodule 수정 금지 원칙과 충돌하므로 채택하지 않는다.

### 모든 `sd_type_t`를 UI에 노출

Q2/Q3, IQ, MXFP4 등 더 많은 enum이 존재하지만 Stable Diffusion 품질과 Android Vulkan 실행이
검증되지 않았다. 선택지가 실행 가능성을 의미하도록 검증된 작은 allowlist를 사용한다.

### 원본 파일을 결과로 교체

저장 공간은 줄지만 실패 시 원본을 잃고 다른 양자화 타입을 비교할 수 없다. 원본 보존을 우선한다.

## Consequences

- 사용자는 Android 기기 안에서 가져온 모델로부터 별도의 양자화 GGUF를 만들 수 있다.
- 결과 GGUF는 기존 생성 화면에서 선택하고 mmap 추론에 사용할 수 있다.
- 변환은 tensor 스트리밍이지만 프로세스 전체 메모리 상한을 보장하지 않는다. 가장 큰 tensor,
  변환 버퍼와 upstream의 1GiB 작업 예산을 감당할 실제 기기 검증이 필요하다.
- 원본과 결과가 동시에 존재하므로 변환 중에는 출력 크기만큼 추가 저장 공간이 필요하다.
- 앱 강제 종료 시 임시 파일은 다음 모델 목록 로딩에서 제거된다.
- 진행률은 완료 tensor 수 기준이며 byte 처리량이나 남은 시간을 보장하지 않는다.
- 취소와 백그라운드 작업 지속은 후속 범위다.
