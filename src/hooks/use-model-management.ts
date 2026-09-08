import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { addQuantizationProgressListener, type QuantizationProgressEvent } from 'stable-diffusion';

import { showOperationBlockedAlert } from '@/shared/heavy-operation/blocked-alert';
import { type QuantizationType } from '@/features/models/quantization/options';
import {
  createQuantizationTask,
  type QuantizationTask,
  updateQuantizationTaskProgress,
} from '@/features/models/quantization/progress';
import { useOperationStore } from '@/shared/heavy-operation/store';
import {
  deleteStoredModel,
  inspectStoredModelQuantization,
  loadModels,
  pickAndImportModel,
  quantizeStoredModel,
  updateStoredModel,
} from '@/storage/model-storage';
import type { StoredModel } from '@/features/models/model';

export function useModelManagement() {
  const [models, setModels] = useState<StoredModel[]>([]);
  const [section, setSection] = useState<StoredModel['kind']>('model');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isQuantizing, setIsQuantizing] = useState(false);
  const [quantizationTask, setQuantizationTask] = useState<QuantizationTask | null>(null);
  const activeOperation = useOperationStore((state) => state.activeOperation);
  const tryStartOperation = useOperationStore((state) => state.tryStartOperation);
  const finishOperation = useOperationStore((state) => state.finishOperation);
  const selectedModel = models.find((model) => model.id === selectedId) ?? null;
  const visibleModels = models.filter((model) => model.kind === section);

  useEffect(() => {
    loadModels()
      .then(setModels)
      .catch(showError)
      .finally(() => setIsLoading(false));
  }, []);

  const updateSelected = (changes: Partial<StoredModel>) => {
    if (!selectedModel) return;
    setModels((current) =>
      current.map((model) => (model.id === selectedModel.id ? { ...model, ...changes } : model)),
    );
  };

  const persistSelected = async (changes: Partial<StoredModel> = {}) => {
    if (!selectedModel) return;
    if (activeOperation) {
      showOperationBlockedAlert(activeOperation, '모델 정보 변경');
      return;
    }
    const next = { ...selectedModel, ...changes };
    updateSelected(changes);
    try {
      setModels(
        await updateStoredModel(next.id, {
          alias: next.alias,
          kind: next.kind,
          description: next.description,
        }),
      );
    } catch (error) {
      showError(error);
      setModels(await loadModels());
    }
  };

  const closeSelected = () => {
    if (!activeOperation) void persistSelected();
    setSelectedId(null);
  };

  const deleteSelected = () => {
    if (!selectedModel) return;
    if (activeOperation) {
      showOperationBlockedAlert(activeOperation, '모델 삭제');
      return;
    }
    Alert.alert('파일을 삭제할까요?', selectedModel.fileName, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setModels(await deleteStoredModel(selectedModel.id));
            setSelectedId(null);
          } catch (error) {
            showError(error);
          }
        },
      },
    ]);
  };

  const importModel = async () => {
    const operation = tryStartOperation({ kind: 'modelImport', label: '모델 가져오기' });
    if (!operation) {
      const active = useOperationStore.getState().activeOperation;
      if (active) showOperationBlockedAlert(active, '모델 가져오기');
      return;
    }
    setIsImporting(true);
    try {
      const imported = await pickAndImportModel();
      if (imported) {
        setModels((current) => [...current, imported]);
        setSection(imported.kind);
      }
    } catch (error) {
      showError(error);
    } finally {
      finishOperation(operation.id);
      setIsImporting(false);
    }
  };

  const inspectSelectedQuantization = () => {
    if (!selectedModel) return false;
    try {
      const availability = inspectStoredModelQuantization(selectedModel);
      if (availability.type === 'available') return true;
      if (availability.type === 'alreadyQuantized') {
        const type =
          availability.primaryType === 'mixed'
            ? '혼합 타입'
            : availability.primaryType.toUpperCase();
        Alert.alert('이미 양자화된 모델입니다.', `${type} 텐서 저장 타입이 감지되었습니다.`);
        return false;
      }
      Alert.alert('양자화할 수 없는 모델입니다.', availability.reason);
      return false;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const quantizeSelected = async (type: QuantizationType) => {
    if (!selectedModel || isQuantizing) return;
    const operation = tryStartOperation({ kind: 'quantization', label: '모델 양자화' });
    if (!operation) {
      const active = useOperationStore.getState().activeOperation;
      if (active) showOperationBlockedAlert(active, '모델 양자화');
      return;
    }
    const source = selectedModel;
    setIsQuantizing(true);
    setQuantizationTask(
      createQuantizationTask({ modelId: source.id, modelName: source.alias, type }),
    );
    setSelectedId(null);
    const progressSubscription = addQuantizationProgressListener(
      (progress: QuantizationProgressEvent) => {
        setQuantizationTask((current) =>
          current ? updateQuantizationTaskProgress(current, progress) : current,
        );
      },
    );
    try {
      await updateStoredModel(source.id, {
        alias: source.alias,
        kind: source.kind,
        description: source.description,
      });
      const result = await quantizeStoredModel(source.id, type);
      setModels(result.models);
      setSection('model');
      Alert.alert(
        '양자화가 완료되었습니다.',
        `${result.model.alias}\n${formatBytes(result.model.sizeBytes)}`,
      );
    } catch (error) {
      showError(error);
    } finally {
      progressSubscription.remove();
      finishOperation(operation.id);
      setQuantizationTask(null);
      setIsQuantizing(false);
    }
  };

  const changeSelectedKind = (kind: StoredModel['kind']) => {
    void persistSelected({ kind });
    setSection(kind);
  };

  const renameSelected = (alias: string) => {
    void persistSelected({ alias });
  };

  const changeSelectedDescription = (description: string) => {
    updateSelected({ description });
  };

  const commitSelectedDescription = () => {
    void persistSelected();
  };

  const showSelectedOperationBlocked = () => {
    if (activeOperation) showOperationBlockedAlert(activeOperation, '모델 변경');
  };

  return {
    models,
    visibleModels,
    selectedModel,
    section,
    isLoading,
    isImporting,
    isQuantizing,
    isOperationBlocked: Boolean(activeOperation),
    quantizationTask,
    selectSection: (nextSection: StoredModel['kind']) => setSection(nextSection),
    selectModel: (modelId: string) => setSelectedId(modelId),
    closeSelected,
    deleteSelected,
    importModel,
    changeSelectedKind,
    renameSelected,
    changeSelectedDescription,
    commitSelectedDescription,
    inspectSelectedQuantization,
    quantizeSelected,
    showSelectedOperationBlocked,
  };
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function showError(error: unknown) {
  Alert.alert(
    '모델을 처리하지 못했습니다.',
    error instanceof Error ? error.message : String(error),
  );
}
