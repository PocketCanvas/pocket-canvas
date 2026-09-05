# ADR-020: SQLite 기반 모델·이미지 메타데이터 저장

## Status

Accepted

ADR-006/007/008/012의 JSON 인덱스 저장 방식과 ADR-015의 저장소별 JSON commit 큐를 대체한다. 파일 보존, 생성 계약, complete/missing 복구, 무거운 작업 잠금은 유지한다.

## Date

2026-09-05

## Context

모델과 이미지 메타데이터가 JSON 배열 파일로 관리되면서 작은 수정에도 전체 읽기·직렬화·재기록과 수동 commit 큐가 필요했다. 즐겨찾기 변경까지 PNG 디렉터리 스캔을 반복했다. 항목 수와 생성 옵션이 늘어날수록 파일 교체·동시 수정·복구 관리 코드가 커지는 것이 문제이며, 실측 성능 수치에 근거한 전환은 아니다.

## Decision

- Expo SDK 57 호환 `expo-sqlite ~57.0.2`를 사용한다. ORM은 추가하지 않는다.
- 기본 앱 전용 DB 디렉터리에 `pocket-canvas.db`를 지연 생성한다. Android의 현재 Expo 구현은 `files/SQLite`를 사용한다. 캐시 디렉터리는 사용하지 않는다.
- `metadata-storage.ts`는 연결과 초기화 재시도를, `metadata-database.ts`는 SQL·스키마·짧은 쓰기 트랜잭션을 소유한다. 화면은 기존 파일 저장소 모듈을 통해 접근한다.
- 모델·PNG 본체는 계속 Expo FileSystem의 document 디렉터리에 둔다. DB에 BLOB으로 넣거나 파일을 이동하지 않는다. 테마의 AsyncStorage도 유지한다.
- `models`는 ID·고유 파일명·레코드별 metadata, `images`는 ID·고유 파일명·생성 시각·즐겨찾기·레코드별 metadata를 저장한다. 중첩 생성 설정은 행 하나의 JSON payload로 보존한다. 이는 전체 카탈로그 JSON 파일 관리와 다르며, 옵션마다 테이블·관계·마이그레이션을 늘리지 않기 위한 선택이다.
- 즐겨찾기는 SQL에서 한 행의 값을 반전한다. 이미지 상세 payload와 별도인 ID·favorite 열이 조회 결과의 기준이다. 모델 별칭·분류·설명도 해당 행만 수정한다.
- WAL과 `withExclusiveTransactionAsync`를 사용한다. 모든 쓰기는 단일 JS commit 큐에서 트랜잭션 연결로 실행한다. 긴 복사·검사·생성·양자화·디렉터리 스캔은 큐 밖에 둔다. 삭제 시 파일 삭제와 복구 시 존재 확인만 짧은 동기 callback으로 큐 안에서 수행한다.
- `PRAGMA user_version = 1`로 스키마를 관리한다. 더 높은 버전은 초기화하거나 덮어쓰지 않고 오류로 중단한다.
- `models.json`과 `images/meta.json`은 읽거나 쓰지 않는다. JSON 인덱스 이전 경로와 `storage_migrations` 표식은 두지 않는다. 디스크에 남은 JSON 파일은 무시한다.

### PNG 복구와 실패 경계

히스토리 로드 시 파일이 존재하는 DB 항목을 표시하고 미등록 PNG를 `missing` 레코드로 등록한다. 복구는 큐 안에서 파일 존재를 다시 확인하며, 같은 파일의 정상 metadata를 덮어쓰거나 즐겨찾기를 초기화하지 않는다. 뒤늦은 정상 metadata 저장은 기존 ID·즐겨찾기를 유지하고 상세 설정만 채운다.

PNG 생성 후 metadata 저장 실패는 여전히 warning을 가진 생성 성공이다. PNG는 삭제하지 않으며 DB가 다시 사용 가능해지면 히스토리 로드에서 복구한다. DB 자체를 열 수 없을 때는 히스토리 로드 오류를 표시한다.

SQLite 트랜잭션은 FileSystem까지 원자적으로 묶지 않는다. 파일 삭제가 예외를 던지면 DB 삭제를 rollback한다. 그러나 파일 삭제 성공 직후 프로세스 종료 또는 DB commit 실패 시 파일 없는 레코드가 남을 수 있다. 히스토리는 이를 숨기며 모델 항목은 기존 파일 존재 검사에서 사용을 거절하고 삭제로 정리할 수 있다. 모델 파일 이동 후 DB 등록 전 종료 시 고아 모델 파일이 남을 가능성도 기존과 동일하다. SQLite가 이런 파일 경계를 해결했다고 주장하지 않는다.

### Android 저장공간 정리

Android 설정의 **데이터 삭제**는 앱 전용 DB와 document 파일을 삭제한다. 다음 실행에서는 빈 DB를 만들고 정상 초기화한다. **캐시 삭제**는 이 DB·모델·PNG를 삭제하지 않는다. 재설치와 OS 백업 복원은 별개이며 백업 정책 변경이나 앱 내부 초기화 UI는 이번 범위에 넣지 않는다.

## Alternatives Considered

- JSON 유지: 추가 의존성은 없지만 전체 파일 교체·동시성·복구 코드의 증가를 해결하지 못한다.
- JSON 1회 이전: 구버전 설치의 인덱스를 SQLite로 옮길 수 있지만, 현재 사용 설치가 SQLite로 옮겨진 뒤에는 읽히지 않는 경로만 남는다. 업그레이드 인구가 없어 두지 않는다.
- AsyncStorage 기반 인덱스: key-value 저장만으로 여러 레코드 수정의 SQL 트랜잭션을 대체하지 못한다.
- 모든 생성 옵션 정규화/ORM: 현재 쿼리에서 사용하지 않는 중첩 설정까지 분해하면 유지보수 부담이 커진다. 검색·페이지네이션 수요가 확인되면 필요한 열과 인덱스만 추가한다.

## Consequences

- 전체 JSON 인덱스 쓰기와 즐겨찾기마다 파일 스캔하던 경로가 사라진다. 히스토리 최초 로드/새로고침은 여전히 전체 목록과 PNG 디렉터리를 읽는다. 페이지네이션이나 성능 벤치마크는 이번 범위가 아니다.
- 새 네이티브 모듈이 추가되어 앱 재빌드가 필요하다. SQLite API는 Android/iOS를 지원하지만 Pocket Canvas 전체의 iOS 네이티브 추론 지원을 의미하지 않는다. 웹 전용 저장소는 구현하지 않는다.
- 자동 테스트는 Node 22의 실제 SQLite로 rollback·동시 즐겨찾기·복구 경쟁·재연결 영속성을 검증한다. Expo 네이티브 연결과 구분한다.
- 실기기 확인 항목: 재시작 후 모델 속성/생성 설정/즐겨찾기 보존 → 새 생성·양자화·삭제 → 캐시 삭제 후 유지. 데이터 삭제 시험은 사용자 데이터가 없는 별도 시험 설치에서만 수행한다.

## References

- [Expo SQLite API와 트랜잭션](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Android 앱별 저장소](https://developer.android.com/training/data-storage/app-specific)
- [Android 저장공간 정리](https://support.google.com/android/answer/7431795)
