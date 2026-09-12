import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addOnnxPocProgressListener,
  generateOnnxPoc,
  inspectOnnxPipeline,
  type OnnxPocProgressEvent,
} from 'stable-diffusion';

import { AppIcon } from '@/components/common/app-icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { useTheme } from '@/hooks/use-theme';
import {
  ONNX_POC_CFG,
  ONNX_POC_HEIGHT,
  ONNX_POC_NEGATIVE_PROMPT,
  ONNX_POC_PROMPT,
  ONNX_POC_REQUIRED_FILES,
  ONNX_POC_SEED,
  ONNX_POC_STEPS,
  ONNX_POC_WIDTH,
  parseOnnxPocGeneration,
  parseOnnxPocInspection,
  type OnnxPocInspection,
  type OnnxPocSessionInspection,
  type OnnxTensorInfo,
} from '@/features/onnx-poc/pipeline';
import { showOperationBlockedAlert } from '@/shared/heavy-operation/blocked-alert';
import { useOperationStore } from '@/shared/heavy-operation/store';

export default function OnnxPocScreen() {
  const colors = useTheme();
  const [inspection, setInspection] = useState<OnnxPocInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<OnnxPocProgressEvent | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = addOnnxPocProgressListener(setProgress);
    return () => subscription.remove();
  }, []);

  const handleInspect = useCallback(async () => {
    setIsInspecting(true);
    setError(null);
    try {
      setInspection(parseOnnxPocInspection(await inspectOnnxPipeline()));
    } catch (caught) {
      setInspection({
        ok: false,
        rootPath: null,
        missing: [],
        error: caught instanceof Error ? caught.message : 'ONNX 파이프라인을 열지 못했습니다.',
      });
    } finally {
      setIsInspecting(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    const operation = useOperationStore.getState().tryStartOperation({
      kind: 'generation',
      label: 'ONNX 실험 생성',
    });
    if (!operation) {
      const active = useOperationStore.getState().activeOperation;
      if (active) showOperationBlockedAlert(active, 'ONNX 실험 생성');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setProgress({ stage: 'encoding', step: 0, steps: ONNX_POC_STEPS });
    try {
      const result = parseOnnxPocGeneration(
        await generateOnnxPoc({
          prompt: ONNX_POC_PROMPT,
          negativePrompt: ONNX_POC_NEGATIVE_PROMPT,
          width: ONNX_POC_WIDTH,
          height: ONNX_POC_HEIGHT,
          steps: ONNX_POC_STEPS,
          cfgScale: ONNX_POC_CFG,
          seed: ONNX_POC_SEED,
        }),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setElapsedMs(result.elapsedMs);
      setImageUri(`file://${result.outputPath}?t=${Date.now()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ONNX 생성에 실패했습니다.');
    } finally {
      useOperationStore.getState().finishOperation(operation.id);
      setIsGenerating(false);
    }
  }, []);

  const busy = isInspecting || isGenerating;

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
          Chilloutmix 실사 프롬프트로 512×512, 20 steps, CFG 7, seed 42 한 장을 만듭니다. 백엔드는
          ORT CPU입니다.
        </Text>

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.tensorLabel, { color: colors.muted }]}>프롬프트</Text>
          <Text style={[styles.path, { color: colors.text }]}>{ONNX_POC_PROMPT}</Text>
          <Text style={[styles.tensorLabel, { color: colors.muted }]}>네거티브</Text>
          <Text style={[styles.path, { color: colors.textSecondary }]}>
            {ONNX_POC_NEGATIVE_PROMPT}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void handleGenerate()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent },
            (pressed || busy) && styles.pressed,
          ]}
        >
          {isGenerating ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>이미지 생성</Text>
          )}
        </Pressable>

        {isGenerating && progress ? (
          <Text style={[styles.path, { color: colors.muted }]}>
            {progress.stage}
            {progress.stage === 'sampling' ? ` ${progress.step}/${progress.steps}` : ''}
          </Text>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        {imageUri ? (
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Image
              accessibilityLabel="ONNX 실험 생성 결과"
              contentFit="contain"
              source={{ uri: imageUri }}
              style={styles.preview}
            />
            {elapsedMs != null ? (
              <Text style={[styles.path, { color: colors.muted }]}>
                {(elapsedMs / 1000).toFixed(1)}초 · {ONNX_POC_WIDTH}×{ONNX_POC_HEIGHT} ·{' '}
                {ONNX_POC_STEPS} steps
              </Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void handleInspect()}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.border },
            (pressed || busy) && styles.pressed,
          ]}
        >
          {isInspecting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>세션 열기</Text>
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
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
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
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#111',
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
