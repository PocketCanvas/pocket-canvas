# Pocket Canvas에 기여하기

Pocket Canvas에 관심을 가져 주셔서 감사합니다.

Pocket Canvas는 Android에서 유연하게 사용할 수 있는 온디바이스 Stable Diffusion 환경을 목표로 합니다. 버그 제보, 기기 호환성 보고, 문서 개선과 코드 기여를 환영합니다.

## 기여하기 전에

- 새 Issue를 작성하기 전에 기존 Issue를 확인해 주세요.
- 큰 기능이나 아키텍처 변경은 구현에 앞서 Issue에서 먼저 논의해 주세요.
- 변경 전에 [`AGENTS.md`](AGENTS.md), [아키텍처 문서](docs/architecture.md)와 관련 ADR을 읽어 주세요.
- `stable-diffusion/cpp/stable-diffusion.cpp/` 서브모듈은 직접 수정하지 않습니다.
- 커스텀 추론·양자화·메모리 정책은 `StableDiffusionBridge.cpp`에서 구현합니다.
- Kotlin 모듈은 API 계약 검증, lifecycle, 이벤트 전달과 실행 큐 지정만 담당합니다.
- `stable-diffusion/android/build.gradle`에 `minSdkVersion`을 직접 선언하지 않습니다.
- 루트와 로컬 모듈의 Expo, React, React Native 호환 세대를 함께 유지합니다.
- `npm audit fix --force`를 사용하지 않습니다.

## 개발 환경

개발 환경 구성과 프로젝트 구조는 다음 문서를 참고해 주세요.

- [README](README.md)
- [아키텍처](docs/architecture.md)
- [Docker Android 릴리즈 빌드](docs/docker-release-build.md)
- [문제 해결](docs/troubleshooting.md)
- [Architecture Decision Records](docs/decisions/)

## Pull Request

1. 저장소를 fork하고 작업 목적에 맞는 브랜치를 만듭니다.
2. 하나의 Pull Request에는 한 가지 목적에 집중한 변경만 포함합니다.
3. 제출 전에 변경 범위에 맞는 lint, 타입 검사, 테스트와 빌드를 실행합니다.
4. 무엇을 변경했고 어떻게 검증했는지 Pull Request에 설명합니다.
5. 기기별 동작과 관련된 변경에는 검증에 사용한 Android 기기와 SoC를 적습니다.

`stable-diffusion/src/`를 변경했다면 반드시 다음 빌드를 실행해 주세요.

```bash
cd stable-diffusion && npm run build
```

## 버그 제보

추론, 성능 또는 메모리 문제를 제보할 때는 가능한 범위에서 다음 정보를 포함해 주세요.

- Android 기기와 SoC
- Android 버전
- 모델 family
- 모델 형식과 양자화 타입
- 해상도와 생성 설정
- 문제를 재현하는 과정
- 관련 로그

생성 관련 네이티브 로그는 다음 명령으로 확인할 수 있습니다.

```bash
adb logcat -s StableDiffusionBridge:I '*:S'
```

## 라이선스

프로젝트에 기여하면 해당 기여물이 프로젝트의 [MIT License](LICENSE)에 따라 배포되는 것에 동의하는 것으로 간주합니다.
