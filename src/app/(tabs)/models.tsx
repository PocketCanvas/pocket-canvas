import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/common/app-icon';
import { ScreenHeader } from '@/components/common/screen-header';

import {
  ManagedModel,
  MODEL_KINDS,
  ModelCard,
  ModelDetailModal,
  QuantizationProgressBanner,
} from '@/components/models/model-management';
import { useModelManagement } from '@/hooks/use-model-management';
import { useTheme } from '@/hooks/use-theme';
import type { StoredModel } from '@/features/models/model';

export default function ModelsScreen() {
  const colors = useTheme();
  const {
    models,
    visibleModels,
    selectedModel,
    section,
    isLoading,
    isImporting,
    isQuantizing,
    isOperationBlocked,
    quantizationTask,
    selectSection,
    selectModel,
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
  } = useModelManagement();
  const selected = selectedModel ? toManagedModel(selectedModel, colors.accentSoft) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="모델 관리" />

      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {MODEL_KINDS.map(([value, label]) => {
          const selectedTab = section === value;
          const count = models.filter((item) => item.kind === value).length;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab }}
              key={value}
              onPress={() => selectSection(value)}
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
        ) : !visibleModels.length ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>저장된 항목이 없습니다</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              파일을 불러오면 자동으로 분류됩니다.
            </Text>
          </View>
        ) : (
          visibleModels.map((item) => (
            <ModelCard
              item={toManagedModel(item, colors.accentSoft)}
              key={item.id}
              onPress={() => selectModel(item.id)}
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
          (isImporting || isOperationBlocked) && styles.disabled,
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
          isOperationBlocked={isOperationBlocked}
          item={selected}
          key={selected.id}
          onClose={closeSelected}
          onBlockedPress={showSelectedOperationBlocked}
          onDelete={deleteSelected}
          onDescriptionChange={changeSelectedDescription}
          onDescriptionCommit={commitSelectedDescription}
          onKindChange={changeSelectedKind}
          onInspectQuantization={inspectSelectedQuantization}
          onQuantize={quantizeSelected}
          onRename={renameSelected}
        />
      )}
    </SafeAreaView>
  );
}

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
