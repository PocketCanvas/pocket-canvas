import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type IconName } from '@/components/common/app-icon';
import { useTheme } from '@/hooks/use-theme';
import { type OnnxPocBackend } from '@/features/onnx-poc/pipeline';

type BackendOption = {
  backend: OnnxPocBackend;
  label: string;
  description: string;
  iconName: IconName;
};

const BACKEND_OPTIONS: BackendOption[] = [
  {
    backend: 'cpu',
    label: 'CPU',
    description: '측정된 기준. ORT 기본 CPU',
    iconName: 'Cpu',
  },
  {
    backend: 'xnnpack',
    label: 'XNNPACK',
    description: '최적화된 CPU 커널',
    iconName: 'Layers',
  },
  {
    backend: 'nnapi',
    label: 'NNAPI',
    description: '기기 드라이버가 GPU/DSP/CPU를 고름',
    iconName: 'Gpu',
  },
];

type OnnxPocBackendPickerProps = {
  backend: OnnxPocBackend;
  disabled?: boolean;
  onChange: (backend: OnnxPocBackend) => void;
};

export function OnnxPocBackendPicker({ backend, disabled, onChange }: OnnxPocBackendPickerProps) {
  const colors = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>ORT 백엔드</Text>
      <Text style={[styles.sectionHint, { color: colors.muted }]}>
        설정 탭의 ggml Vulkan/CPU와 다른 선택입니다. QNN은 이 AAR에 없습니다.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {BACKEND_OPTIONS.map((option, index) => {
          const isSelected = backend === option.backend;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled }}
              disabled={disabled}
              key={option.backend}
              onPress={() => onChange(option.backend)}
              style={({ pressed }) => [
                styles.optionRow,
                index < BACKEND_OPTIONS.length - 1 && [
                  styles.borderBottom,
                  { borderBottomColor: colors.border },
                ],
                pressed && !disabled && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.backgroundElement,
                  },
                ]}
              >
                <AppIcon
                  color={isSelected ? 'accentIcon' : 'muted'}
                  name={option.iconName}
                  size="md"
                />
              </View>
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isSelected ? colors.text : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  {option.description}
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: isSelected ? colors.accent : colors.border },
                ]}
              >
                {isSelected ? (
                  <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
