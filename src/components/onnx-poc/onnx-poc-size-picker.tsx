import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ONNX_POC_SIZES, type OnnxPocSize } from '@/features/onnx-poc/pipeline';

const SIZE_HINTS: Record<OnnxPocSize, string> = {
  256: 'CPU 기준 약 40초',
  512: 'CPU 기준 약 4분',
};

type OnnxPocSizePickerProps = {
  size: OnnxPocSize;
  disabled?: boolean;
  onChange: (size: OnnxPocSize) => void;
};

export function OnnxPocSizePicker({ size, disabled, onChange }: OnnxPocSizePickerProps) {
  const colors = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>해상도</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {ONNX_POC_SIZES.map((option, index) => {
          const isSelected = size === option;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled }}
              disabled={disabled}
              key={option}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.optionRow,
                index < ONNX_POC_SIZES.length - 1 && [
                  styles.borderBottom,
                  { borderBottomColor: colors.border },
                ],
                pressed && !disabled && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isSelected ? colors.text : colors.textSecondary },
                  ]}
                >
                  {option}×{option}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  {SIZE_HINTS[option]}
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
