import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { AppIcon, type IconName } from '@/components/common/app-icon';
import { useTheme } from '@/hooks/use-theme';
import { inferenceBackendStore, type InferenceBackend } from '@/shared/inference-backend/store';

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
    description: 'ggml 연산과 메모리 정책은 지금과 같습니다',
    iconName: 'Gpu',
  },
  {
    backend: 'cpu',
    label: 'CPU',
    description: '연산과 파라미터를 모두 CPU에서 실행',
    iconName: 'Cpu',
  },
];

export function InferenceBackendSettings() {
  const colors = useTheme();
  const inferenceBackend = useStore(inferenceBackendStore, (state) => state.inferenceBackend);
  const setInferenceBackend = useStore(inferenceBackendStore, (state) => state.setInferenceBackend);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>추론 백엔드</Text>
      <Text style={[styles.sectionHint, { color: colors.muted }]}>
        CPU는 Vulkan을 쓰지 않고 ggml CPU 백엔드로 로딩·인코딩·샘플링·디코드를 돌립니다.
      </Text>
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
          const isSelected = inferenceBackend === option.backend;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={option.backend}
              onPress={() => setInferenceBackend(option.backend)}
              style={({ pressed }) => [
                styles.optionRow,
                index < BACKEND_OPTIONS.length - 1 && [
                  styles.borderBottom,
                  { borderBottomColor: colors.border },
                ],
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
});
