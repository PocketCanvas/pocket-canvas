import { Alert } from 'react-native';

import type { HeavyOperation } from '@/stores/use-operation-store';

export function showOperationBlockedAlert(
  activeOperation: HeavyOperation,
  requestedAction: string,
) {
  Alert.alert(
    `${activeOperation.label} 진행 중`,
    `${activeOperation.label}이 끝난 뒤 ${requestedAction}을(를) 다시 시도해 주세요. 사진 보기와 관리는 계속 사용할 수 있습니다.`,
    [{ text: '확인' }],
  );
}
