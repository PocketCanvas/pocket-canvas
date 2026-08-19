import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LoraSelection } from '@/components/generate/lora-sortable-list';
import { useTheme } from '@/hooks/use-theme';
import { StoredModel } from '@/lib/model-files';

export function ModelPicker({
  title = '모델 선택',
  visible,
  models,
  selected,
  onClose,
  onSelect,
  defaultOptionLabel,
}: {
  title?: string;
  visible: boolean;
  models: StoredModel[];
  selected: StoredModel | null;
  onClose: () => void;
  onSelect: (model: StoredModel | null) => void;
  defaultOptionLabel?: string;
}) {
  const colors = useTheme();
  const [showAll, setShowAll] = useState(false);
  const visibleModels = showAll ? models : models.filter(({ kind }) => kind === 'model');

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: colors.surfaceRaised }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <ShowAll checked={showAll} onChange={setShowAll} />
          {defaultOptionLabel && (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === null }}
              onPress={() => onSelect(null)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={[styles.defaultOptionText, { color: colors.text }]}>
                {defaultOptionLabel}
              </Text>
              <View
                style={[
                  styles.radio,
                  { borderColor: selected === null ? colors.accent : colors.muted },
                  selected === null && { borderWidth: 5 },
                ]}
              />
            </Pressable>
          )}
          <ScrollView style={styles.options}>
            {visibleModels.map((model) => {
              const isChecked = selected?.id === model.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isChecked }}
                  key={model.id}
                  onPress={() => onSelect(model)}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionText, { color: colors.text }]}>{model.alias}</Text>
                    <Text style={[styles.hint, { color: colors.muted }]}>
                      {formatModelInfo(model)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: isChecked ? colors.accent : colors.muted },
                      isChecked && { borderWidth: 5 },
                    ]}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          {!visibleModels.length && (
            <Text style={[styles.empty, { color: colors.muted }]}>선택할 파일이 없습니다.</Text>
          )}
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
  const colors = useTheme();
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll ? options : options.filter(({ kind }) => kind === 'lora');

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: colors.surfaceRaised }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>LoRA 선택</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            생성에 적용할 LoRA를 여러 개 선택할 수 있습니다.
          </Text>
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
                    <Text style={[styles.optionText, { color: colors.text }]}>{model.alias}</Text>
                    <Text style={[styles.hint, { color: colors.muted }]}>
                      {formatModelInfo(model)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: checked ? colors.accent : colors.muted,
                        backgroundColor: checked ? colors.accent : 'transparent',
                      },
                    ]}
                  >
                    {checked && (
                      <Text style={[styles.checkmark, { color: colors.onAccent }]}>✓</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {!visibleOptions.length && (
            <Text style={[styles.empty, { color: colors.muted }]}>선택할 파일이 없습니다.</Text>
          )}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.done,
                { backgroundColor: colors.accent },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.doneText, { color: colors.onAccent }]}>
                선택 완료 · {selected.length}개
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ShowAll({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.showAll}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? colors.accent : colors.muted,
            backgroundColor: checked ? colors.accent : 'transparent',
          },
        ]}
      >
        {checked && <Text style={[styles.checkmark, { color: colors.onAccent }]}>✓</Text>}
      </View>
      <Text style={[styles.showAllText, { color: colors.text }]}>전체 보기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    gap: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 19, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 13, marginBottom: 8 },
  options: { maxHeight: 360 },
  empty: { fontSize: 13, paddingVertical: 20, textAlign: 'center' },
  showAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  showAllText: { fontSize: 14 },
  option: {
    minHeight: 52,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  defaultOptionText: { flex: 1, fontSize: 14 },
  optionCopy: { flex: 1, gap: 2, marginRight: 12 },
  optionText: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
  hint: { fontSize: 12, lineHeight: 16 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 2,
  },
  checkmark: { fontSize: 14, fontWeight: '800' },
  footer: { marginTop: 12 },
  done: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  doneText: { fontWeight: '700' },
});

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

export function formatModelInfo(model: StoredModel) {
  const format = model.format === 'gguf' ? 'GGUF' : 'SafeTensors';
  const size = formatBytes(model.sizeBytes);
  return `${format} · ${size}`;
}
