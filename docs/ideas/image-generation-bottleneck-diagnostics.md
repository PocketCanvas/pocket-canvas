# 이미지 생성 병목 진단

> 실험 완료. 결과와 채택 결정은 [ADR-009](../decisions/ADR-009-generation-profiling-and-taesd-poc.md)에 기록한다.

## Problem Statement

어떻게 하면 S26의 이미지 생성 과정에서 단계별 시간과 자원 사용을 재현 가능하게 측정해, CPU와 Vulkan GPU 사이의 실제 병목을 추측 없이 특정할 수 있을까?

## Recommended Direction

`StableDiffusionBridge.cpp`에서 생성 전체와 loading, encoding, sampling, decoding, PNG 저장, context 해제 구간의 wall time, 프로세스 CPU time, RSS를 `adb logcat`에 기록한다. Sampling은 step별 시간도 기록하고, 생성 시작 시 stable-diffusion.cpp가 선택한 backend와 Vulkan device 목록을 함께 남긴다.

CPU time이 wall time에 가까우면 CPU 연산을, wall time이 훨씬 크면 GPU 실행·동기화 또는 I/O 대기를 우선 의심한다. 이는 GPU 사용률을 대신하는 확정값이 아니라 다음 정밀 측정 대상을 고르는 분류 신호다.

## Key Assumptions to Validate

- [ ] 동일 조건 3회 실행에서 단계별 시간이 비교 가능한 수준으로 반복된다.
- [x] wall time과 CPU time의 차이로 CPU active 구간과 대기 구간을 구분할 수 있다.
- [x] backend/device 로그로 Xclipse 960 Vulkan 실행 여부를 확인할 수 있다.
- [x] RSS 변화가 모델 로딩과 decode의 메모리 압박을 드러낸다.

## MVP Scope

- 생성별 식별자 없이 한 번에 하나의 생성만 측정
- 전체 및 단계별 wall time, CPU time, CPU/wall 비율, RSS, RSS 변화
- sampling step별 wall time
- backend/device 목록
- 기존 `StableDiffusionBridge` logcat 태그 유지

## Not Doing (and Why)

- GPU 사용률 추정값 — logcat 신호만으로 신뢰할 수 있는 퍼센트를 만들 수 없음
- Samsung 전용 sysfs counter — 기기와 펌웨어 의존성이 큼
- Perfetto/AGI 연동 — logcat으로 병목 단계를 좁히지 못할 때 추가
- UI 대시보드와 JSON/CSV 저장 — 첫 진단에는 adb logcat이면 충분
- 고빈도 메모리 polling — 측정 오버헤드와 로그 노이즈 방지
- stable-diffusion.cpp 수정 — upstream 경계를 유지

## Open Questions

- 가장 느린 단계가 GPU 대기로 분류될 때 Perfetto/AGI가 S26에서 필요한 counter를 제공하는가?
- 반복 실행 중 thermal throttling을 별도 실험 조건으로 통제해야 하는가?
- context 재사용이 모델 loading 병목을 줄일 다음 최적화 후보인가?

## Outcome

- Xclipse 960 Vulkan backend와 VRAM tensor 배치를 확인했다.
- Sampling은 약 58초, 기본 VAE decoding은 약 51초로 측정됐다.
- TAESD는 decoding을 약 0.62초로 줄였지만 최종 이미지 품질 저하가 컸다.
- TAESD는 기본 최종 decoder로 채택하지 않고 명시적 실험 옵션으로 유지한다.
