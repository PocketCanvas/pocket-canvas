import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/common/app-icon';
import { useTheme } from '@/hooks/use-theme';

export function OnnxPocEntry() {
  const colors = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>ONNX 실험</Text>
      <Text style={[styles.sectionHint, { color: colors.muted }]}>
        ggml 생성과 별도로 Chilloutmix ORT 파이프라인을 검사합니다. 설정 백엔드(Vulkan/CPU)는 바꾸지
        않습니다.
      </Text>
      <Pressable
        accessibilityHint="ONNX 실험 화면으로 이동합니다"
        accessibilityLabel="ONNX 실험 열기"
        accessibilityRole="button"
        onPress={() => router.push('/onnx-poc' as Href)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
          <AppIcon color="accentIcon" name="Box" size="md" />
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.text }]}>ONNX 실험 화면</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            고정 경로의 .ort 세션을 열고 입출력을 확인합니다
          </Text>
        </View>
        <AppIcon color="muted" name="ChevronRight" size="md" />
      </Pressable>
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
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.72,
  },
});
