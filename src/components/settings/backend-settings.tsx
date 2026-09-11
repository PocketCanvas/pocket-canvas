import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type IconName } from '@/components/common/app-icon';
import { useInferenceBackend } from '@/hooks/use-inference-backend';
import { useTheme } from '@/hooks/use-theme';
import type { InferenceBackend } from '@/features/generation/backend';

type BackendOption = {
  backend: InferenceBackend;
  label: string;
  description: string;
  iconName: IconName;
};

const BACKEND_OPTIONS: BackendOption[] = [
  {
    backend: 'vulkan',
    label: 'Vulkan',
    description: '검증된 기본 생성 백엔드',
    iconName: 'Layers',
  },
  {
    backend: 'opencl',
    label: 'OpenCL',
    description: '실험용. mmap만 적용합니다',
    iconName: 'Box',
  },
];

export function BackendSettings() {
  const colors = useTheme();
  const { backend, setBackend } = useInferenceBackend();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>추론 백엔드</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {BACKEND_OPTIONS.map((option, index) => {
          const isSelected = backend === option.backend;
          const isLast = index === BACKEND_OPTIONS.length - 1;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={option.backend}
              onPress={() => setBackend(option.backend)}
              style={({ pressed }) => [
                styles.optionRow,
                !isLast && [styles.borderBottom, { borderBottomColor: colors.border }],
                pressed && styles.pressed,
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
                {isSelected && (
                  <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />
                )}
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
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
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
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    fontWeight: '500',
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
});
