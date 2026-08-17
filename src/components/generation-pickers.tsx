import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LoraSelection } from '@/components/lora-sortable-list';
import { Colors } from '@/constants/theme';
import { StoredModel } from '@/lib/model-files';

export function ModelPicker({
  visible,
  models,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  models: StoredModel[];
  selected: StoredModel | null;
  onClose: () => void;
  onSelect: (model: StoredModel) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleModels = showAll ? models : models.filter(({ kind }) => kind === 'model');

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable accessibilityViewIsModal onPress={() => {}} style={styles.sheet}>
          <Text style={styles.title}>모델 선택</Text>
          <ShowAll checked={showAll} onChange={setShowAll} />
          <ScrollView style={styles.options}>
            {visibleModels.map((model) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected?.id === model.id }}
                key={model.id}
                onPress={() => onSelect(model)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionText}>{model.alias}</Text>
                  <Text style={styles.hint}>{model.fileName}</Text>
                </View>
                <View style={[styles.radio, selected?.id === model.id && styles.radioSelected]} />
              </Pressable>
            ))}
          </ScrollView>
          {!visibleModels.length && <Text style={styles.empty}>선택할 파일이 없습니다.</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function LoraPicker({
  visible,
  options,
  selected,
  onChange,
  onClose,
}: {
  visible: boolean;
  options: StoredModel[];
  selected: LoraSelection[];
  onChange: (loras: LoraSelection[]) => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll ? options : options.filter(({ kind }) => kind === 'lora');

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable accessibilityViewIsModal onPress={() => {}} style={styles.sheet}>
          <Text style={styles.title}>LoRA 선택</Text>
          <Text style={styles.description}>생성에 적용할 LoRA를 여러 개 선택할 수 있습니다.</Text>
          <ShowAll checked={showAll} onChange={setShowAll} />
          <ScrollView style={styles.options}>
            {visibleOptions.map((model) => {
              const checked = selected.some((lora) => lora.model.id === model.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  key={model.id}
                  onPress={() =>
                    onChange(
                      checked
                        ? selected.filter((lora) => lora.model.id !== model.id)
                        : [...selected, { model, weight: 1 }],
                    )
                  }
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionText}>{model.alias}</Text>
                    <Text style={styles.hint}>{model.fileName}</Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {!visibleOptions.length && <Text style={styles.empty}>선택할 파일이 없습니다.</Text>}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.done, pressed && styles.pressed]}
            >
              <Text style={styles.doneText}>선택 완료 · {selected.length}개</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ShowAll({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.showAll}
    >
      <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.showAllText}>전체 보기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.dark.backdrop },
  sheet: {
    gap: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Colors.dark.surfaceRaised,
    padding: 20,
    paddingBottom: 32,
  },
  title: { color: Colors.dark.text, fontSize: 19, fontWeight: '700', marginBottom: 8 },
  description: { color: Colors.dark.muted, fontSize: 13, marginBottom: 8 },
  options: { maxHeight: 360 },
  empty: { color: Colors.dark.muted, fontSize: 13, paddingVertical: 20, textAlign: 'center' },
  showAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  showAllText: { color: Colors.dark.text, fontSize: 14 },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  optionText: { flex: 1, color: Colors.dark.text, fontSize: 14 },
  optionCopy: { flex: 1, gap: 3 },
  hint: { color: Colors.dark.muted, fontSize: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderColor: Colors.dark.muted, borderWidth: 2 },
  radioSelected: { borderColor: Colors.dark.accent, borderWidth: 5 },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderColor: Colors.dark.muted,
    borderWidth: 2,
  },
  checkboxSelected: { borderColor: Colors.dark.accent, backgroundColor: Colors.dark.accent },
  checkmark: { color: Colors.dark.onAccent, fontSize: 14, fontWeight: '800' },
  footer: { marginTop: 12 },
  done: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.dark.accent,
  },
  doneText: { color: Colors.dark.onAccent, fontWeight: '700' },
});
