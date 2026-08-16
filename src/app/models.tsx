import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ManagedModel,
  MODEL_KINDS,
  ModelCard,
  ModelDetailModal,
  ModelKind,
} from '@/components/model-management';
import { Colors } from '@/constants/theme';

const INITIAL_ITEMS: ManagedModel[] = [
  // {
  //   id: 'perfect-deliberate',
  //   name: 'PerfectDeliberate_v5',
  //   kind: 'model',
  //   detectedKind: 'model',
  //   format: 'GGUF · Q4_K',
  //   size: '2.1 GB',
  //   filename: 'perfectdeliberate_v5_q4_k.gguf',
  //   description: '사실적인 표현과 섬세한 디테일에 적합한 모델',
  //   color: '#4D6577',
  // },
  {
    id: 'counterfeit',
    name: 'Counterfeit-V3.0',
    kind: 'model',
    detectedKind: 'model',
    format: 'SafeTensors',
    size: '2.0 GB',
    filename: 'counterfeit-v3.0.safetensors',
    description: '인물과 캐릭터 생성에 적합한 범용 모델',
    color: '#536A63',
  },
  {
    id: 'lcm-lora',
    name: 'LCM-LoRA',
    kind: 'lora',
    detectedKind: 'lora',
    format: 'SafeTensors',
    size: '135 MB',
    filename: 'lcm-lora.safetensors',
    description: '적은 스텝으로 빠르게 생성하기 위한 가속 LoRA',
    color: '#665786',
  },
  {
    id: 'unclassified',
    name: 'portrait_style_v2',
    kind: 'unknown',
    detectedKind: 'unknown',
    format: 'SafeTensors',
    size: '144 MB',
    filename: 'portrait_style_v2.safetensors',
    description: '메타데이터만으로 종류를 판별하지 못했습니다.',
    color: '#6A606A',
  },
];

export default function ModelsScreen() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [section, setSection] = useState<ModelKind>('model');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const visibleItems = items.filter((item) => item.kind === section);

  const updateSelected = (changes: Partial<ManagedModel>) => {
    if (!selected) return;
    setItems((current) =>
      current.map((item) => (item.id === selected.id ? { ...item, ...changes } : item)),
    );
  };

  const remove = () => {
    if (!selected) return;
    Alert.alert('파일을 삭제할까요?', selected.filename, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setItems((current) => current.filter((item) => item.id !== selected.id));
          setSelectedId(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          모델 관리
        </Text>
        <Text style={styles.subtitle}>기기에 저장된 생성 리소스</Text>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {MODEL_KINDS.map(([value, label]) => {
          const selectedTab = section === value;
          const count = items.filter((item) => item.kind === value).length;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab }}
              key={value}
              onPress={() => setSection(value)}
              style={[styles.tab, selectedTab && styles.selectedTab]}
            >
              <Text style={[styles.tabText, selectedTab && styles.selectedTabText]}>
                {label} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!visibleItems.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>저장된 항목이 없습니다</Text>
            <Text style={styles.emptyText}>파일을 불러오면 자동으로 분류됩니다.</Text>
          </View>
        ) : (
          visibleItems.map((item) => (
            <ModelCard item={item} key={item.id} onPress={() => setSelectedId(item.id)} />
          ))
        )}
      </ScrollView>

      {selected && (
        <ModelDetailModal
          item={selected}
          key={selected.id}
          onClose={() => setSelectedId(null)}
          onDelete={remove}
          onDescriptionChange={(description) => updateSelected({ description })}
          onKindChange={(kind) => {
            updateSelected({ kind });
            setSection(kind);
          }}
          onRename={(name) => updateSelected({ name })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.dark.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  title: { color: Colors.dark.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: Colors.dark.muted, fontSize: 13, marginTop: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2 },
  selectedTab: { borderBottomColor: Colors.dark.accent },
  tabText: { color: Colors.dark.muted, fontSize: 13, fontWeight: '600' },
  selectedTabText: { color: Colors.dark.accentText },
  content: { padding: 20, paddingBottom: 120, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { color: Colors.dark.text, fontSize: 15, fontWeight: '600' },
  emptyText: { color: Colors.dark.muted, fontSize: 13 },
});
