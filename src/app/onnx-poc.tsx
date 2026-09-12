import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inspectOnnxPipeline } from 'stable-diffusion';

import { AppIcon } from '@/components/common/app-icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { useTheme } from '@/hooks/use-theme';
import {
  ONNX_POC_REQUIRED_FILES,
  parseOnnxPocInspection,
  type OnnxPocInspection,
  type OnnxPocSessionInspection,
  type OnnxTensorInfo,
} from '@/features/onnx-poc/pipeline';

export default function OnnxPocScreen() {
  const colors = useTheme();
  const [inspection, setInspection] = useState<OnnxPocInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  const handleInspect = useCallback(async () => {
    setIsInspecting(true);
    try {
      setInspection(parseOnnxPocInspection(await inspectOnnxPipeline()));
    } catch (error) {
      setInspection({
        ok: false,
        rootPath: null,
        missing: [],
        error: error instanceof Error ? error.message : 'ONNX 파이프라인을 열지 못했습니다.',
      });
    } finally {
      setIsInspecting(false);
    }
  }, []);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        leftAction={
          <Pressable
            accessibilityHint="설정 화면으로 돌아갑니다"
            accessibilityLabel="뒤로"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <AppIcon color="text" name="ChevronLeft" size="lg" />
          </Pressable>
        }
        style={styles.header}
        title="ONNX 실험"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.hint, { color: colors.muted }]}>
          Chilloutmix `.ort` 세 파일과 CLIP tokenizer를 기기 `poc-chilloutmix` 폴더에 넣은 뒤 세션을
          엽니다. 생성은 다음 단계에서 붙입니다.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={isInspecting}
          onPress={() => void handleInspect()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent },
            (pressed || isInspecting) && styles.pressed,
          ]}
        >
          {isInspecting ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>세션 열기</Text>
          )}
        </Pressable>

        {inspection ? <InspectionResult colors={colors} inspection={inspection} /> : null}

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>필요한 파일</Text>
          {ONNX_POC_REQUIRED_FILES.map((file) => (
            <Text key={file} style={[styles.path, { color: colors.muted }]}>
              {file}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InspectionResult({
  colors,
  inspection,
}: {
  colors: ReturnType<typeof useTheme>;
  inspection: OnnxPocInspection;
}) {
  if (!inspection.ok) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>아직 열리지 않았습니다</Text>
        {inspection.rootPath ? (
          <Text style={[styles.path, { color: colors.muted }]}>{inspection.rootPath}</Text>
        ) : null}
        {inspection.error ? (
          <Text style={[styles.error, { color: colors.error }]}>{inspection.error}</Text>
        ) : null}
        {inspection.missing.map((file) => (
          <Text key={file} style={[styles.path, { color: colors.error }]}>
            없음 · {file}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.results}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>세션을 열었습니다</Text>
        <Text style={[styles.path, { color: colors.muted }]}>{inspection.rootPath}</Text>
      </View>
      {inspection.sessions.map((session) => (
        <SessionCard colors={colors} key={session.role} session={session} />
      ))}
    </View>
  );
}

function SessionCard({
  colors,
  session,
}: {
  colors: ReturnType<typeof useTheme>;
  session: OnnxPocSessionInspection;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{session.role}</Text>
      <Text style={[styles.path, { color: colors.muted }]}>{session.relativePath}</Text>
      <TensorList colors={colors} label="입력" tensors={session.inputs} />
      <TensorList colors={colors} label="출력" tensors={session.outputs} />
    </View>
  );
}

function TensorList({
  colors,
  label,
  tensors,
}: {
  colors: ReturnType<typeof useTheme>;
  label: string;
  tensors: OnnxTensorInfo[];
}) {
  return (
    <View style={styles.tensorGroup}>
      <Text style={[styles.tensorLabel, { color: colors.muted }]}>{label}</Text>
      {tensors.map((tensor) => (
        <Text
          key={`${label}-${tensor.name}`}
          style={[styles.path, { color: colors.textSecondary }]}
        >
          {tensor.name} · {tensor.type} · [{tensor.shape.join(', ')}]
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
    paddingBottom: 40,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  results: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  path: {
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
  },
  tensorGroup: {
    marginTop: 8,
    gap: 4,
  },
  tensorLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.72,
  },
});
