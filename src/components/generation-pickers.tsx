import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoraSelection } from '@/components/lora-sortable-list';
import { Colors } from '@/constants/theme';

export function ModelPicker({
  visible,
  models,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  models: string[];
  selected: string;
  onClose: () => void;
  onSelect: (model: string) => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.title}>모델 선택</Text>
          {models.map((model) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === model }}
              key={model}
              onPress={() => onSelect(model)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={styles.optionText}>{model}</Text>
              <View style={[styles.radio, selected === model && styles.radioSelected]} />
            </Pressable>
          ))}
        </View>
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
  options: string[];
  selected: LoraSelection[];
  onChange: (loras: LoraSelection[]) => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable accessibilityViewIsModal onPress={() => {}} style={styles.sheet}>
          <Text style={styles.title}>LoRA 선택</Text>
          <Text style={styles.description}>생성에 적용할 LoRA를 여러 개 선택할 수 있습니다.</Text>
          {options.map((name) => {
            const checked = selected.some((lora) => lora.name === name);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                key={name}
                onPress={() =>
                  onChange(
                    checked
                      ? selected.filter((lora) => lora.name !== name)
                      : [...selected, { name, weight: 1 }],
                  )
                }
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionText}>{name}</Text>
                  <Text style={styles.hint}>LoRA 모델</Text>
                </View>
                <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
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
