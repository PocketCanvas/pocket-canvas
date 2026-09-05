import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addQuantizationProgressListener, type QuantizationProgressEvent } from 'stable-diffusion';

import { AppIcon } from '@/components/common/app-icon';
import { ScreenHeader } from '@/components/common/screen-header';

import {
  ManagedModel,
  MODEL_KINDS,
  ModelCard,
  ModelDetailModal,
  ModelKind,
  QuantizationProgressBanner,
} from '@/components/models/model-management';
import { useTheme } from '@/hooks/use-theme';
import { showOperationBlockedAlert } from '@/lib/heavy-operation';
import {
  deleteStoredModel,
  inspectStoredModelQuantization,
  loadModels,
  pickAndImportModel,
  quantizeStoredModel,
  StoredModel,
  updateStoredModel,
} from '@/lib/model-files';
import {
  createQuantizationTask,
  type QuantizationTask,
  type QuantizationType,
  updateQuantizationTaskProgress,
} from '@/lib/model-quantization';
import { useOperationStore } from '@/stores/use-operation-store';

export default function ModelsScreen() {
  const colors = useTheme();
  const [items, setItems] = useState<StoredModel[]>([]);
  const [section, setSection] = useState<ModelKind>('model');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isQuantizing, setIsQuantizing] = useState(false);
  const [quantizationTask, setQuantizationTask] = useState<QuantizationTask | null>(null);
  const activeOperation = useOperationStore((state) => state.activeOperation);
  const tryStartOperation = useOperationStore((state) => state.tryStartOperation);
  const finishOperation = useOperationStore((state) => state.finishOperation);
  const selectedRecord = items.find((item) => item.id === selectedId) ?? null;
  const selected = selectedRecord ? toManagedModel(selectedRecord, colors.accentSoft) : null;
  const visibleItems = items.filter((item) => item.kind === section);

  useEffect(() => {
    loadModels()
      .then(setItems)
      .catch(showError)
      .finally(() => setIsLoading(false));
  }, []);

  const updateLocal = (changes: Partial<StoredModel>) => {
    if (!selectedRecord) return;
    setItems((current) =>
      current.map((item) => (item.id === selectedRecord.id ? { ...item, ...changes } : item)),
    );
  };

  const persistSelected = async (changes: Partial<StoredModel> = {}) => {
    if (!selectedRecord) return;
    if (activeOperation) {
      showOperationBlockedAlert(activeOperation, '모델 정보 변경');
      return;
    }
    const next = { ...selectedRecord, ...changes };
    updateLocal(changes);
    try {
      setItems(
        await updateStoredModel(next.id, {
          alias: next.alias,
          kind: next.kind,
          description: next.description,
        }),
      );
    } catch (error) {
      showError(error);
      setItems(await loadModels());
    }
  };

  const remove = () => {
    if (!selectedRecord) return;
    if (activeOperation) {
      showOperationBlockedAlert(activeOperation, '모델 삭제');
      return;
    }
    Alert.alert('파일을 삭제할까요?', selectedRecord.fileName, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setItems(await deleteStoredModel(selectedRecord.id));
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
        setItems((current) => [...current, imported]);
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
    if (!selectedRecord) return false;
    try {
      const availability = inspectStoredModelQuantization(selectedRecord);
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
    if (!selectedRecord || isQuantizing) return;
    const operation = tryStartOperation({ kind: 'quantization', label: '모델 양자화' });
    if (!operation) {
      const active = useOperationStore.getState().activeOperation;
      if (active) showOperationBlockedAlert(active, '모델 양자화');
      return;
    }
    const source = selectedRecord;
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
      setItems(result.models);
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

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="모델 관리" />

      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {MODEL_KINDS.map(([value, label]) => {
          const selectedTab = section === value;
          const count = items.filter((item) => item.kind === value).length;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab }}
              key={value}
              onPress={() => setSection(value)}
              style={[
                styles.tab,
                selectedTab && [styles.selectedTab, { borderBottomColor: colors.accent }],
              ]}
            >
              <Text
                style={[styles.tabText, { color: selectedTab ? colors.accentText : colors.muted }]}
              >
                {label} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {quantizationTask && (
        <View style={styles.progressContainer}>
          <QuantizationProgressBanner task={quantizationTask} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} size="large" style={styles.loading} />
        ) : !visibleItems.length ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>저장된 항목이 없습니다</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              파일을 불러오면 자동으로 분류됩니다.
            </Text>
          </View>
        ) : (
          visibleItems.map((item) => (
            <ModelCard
              item={toManagedModel(item, colors.accentSoft)}
              key={item.id}
              onPress={() => setSelectedId(item.id)}
            />
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityLabel="모델 파일 추가"
        accessibilityRole="button"
        disabled={isImporting}
        onPress={importModel}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent },
          pressed && styles.pressed,
          (isImporting || activeOperation) && styles.disabled,
        ]}
      >
        {isImporting ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <AppIcon color="onAccent" name="Plus" size="xl" strokeWidth={2.2} />
        )}
      </Pressable>

      {selected && (
        <ModelDetailModal
          isQuantizing={isQuantizing}
          isOperationBlocked={Boolean(activeOperation)}
          item={selected}
          key={selected.id}
          onClose={() => {
            if (!activeOperation) persistSelected();
            setSelectedId(null);
          }}
          onBlockedPress={() => {
            if (activeOperation) showOperationBlockedAlert(activeOperation, '모델 변경');
          }}
          onDelete={remove}
          onDescriptionChange={(description) => updateLocal({ description })}
          onDescriptionCommit={() => persistSelected()}
          onKindChange={(kind) => {
            persistSelected({ kind });
            setSection(kind);
          }}
          onInspectQuantization={inspectSelectedQuantization}
          onQuantize={quantizeSelected}
          onRename={(alias) => persistSelected({ alias })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: {},
  tabText: { fontSize: 13, fontWeight: '600' },
  selectedTabText: {},
  content: { padding: 20, paddingBottom: 120, gap: 10 },
  progressContainer: { paddingHorizontal: 20, paddingTop: 16 },
  loading: { marginTop: 64 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});

function toManagedModel(model: StoredModel, accentSoftColor: string): ManagedModel {
  return {
    id: model.id,
    name: model.alias,
    kind: model.kind,
    detectedKind: model.detectedKind,
    format: model.format === 'gguf' ? 'GGUF' : 'SafeTensors',
    size: formatBytes(model.sizeBytes),
    filename: model.fileName,
    description: model.description,
    quantization: model.quantization,
    color: accentSoftColor,
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
