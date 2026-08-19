import { Plus } from 'lucide-react-native';
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

import {
  ManagedModel,
  MODEL_KINDS,
  ModelCard,
  ModelDetailModal,
  ModelKind,
} from '@/components/model-management';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteStoredModel,
  loadModels,
  pickAndImportModel,
  StoredModel,
  updateStoredModel,
} from '@/lib/model-files';

export default function ModelsScreen() {
  const colors = useTheme();
  const [items, setItems] = useState<StoredModel[]>([]);
  const [section, setSection] = useState<ModelKind>('model');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
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
      setIsImporting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          모델 관리
        </Text>
      </View>

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
          isImporting && styles.disabled,
        ]}
      >
        {isImporting ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Plus color={colors.onAccent} size={28} strokeWidth={2.2} />
        )}
      </Pressable>

      {selected && (
        <ModelDetailModal
          item={selected}
          key={selected.id}
          onClose={() => {
            persistSelected();
            setSelectedId(null);
          }}
          onDelete={remove}
          onDescriptionChange={(description) => updateLocal({ description })}
          onDescriptionCommit={() => persistSelected()}
          onKindChange={(kind) => {
            persistSelected({ kind });
            setSection(kind);
          }}
          onRename={(alias) => persistSelected({ alias })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
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
