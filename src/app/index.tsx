import { useFocusEffect } from 'expo-router';
import { Box, ChevronRight, Plus, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addProgressListener,
  BuiltInUpscalerType,
  generateImage,
  GenerationProgressEvent,
  SamplingPreset,
} from 'stable-diffusion';
import {
  AdvancedGenerationOptions,
  IMAGE_SIZE_OPTIONS,
  type ImageSizeOption,
} from '@/components/generate/advanced-generation-options';
import { GenerationControls } from '@/components/generate/generation-controls';
import { formatModelInfo, LoraPicker, ModelPicker } from '@/components/generate/generation-pickers';
import { LoraSelection, LoraSortableList } from '@/components/generate/lora-sortable-list';
import { useTheme } from '@/hooks/use-theme';
import { generationProgressDetail } from '@/lib/generation-progress';
import { showOperationBlockedAlert } from '@/lib/heavy-operation';
import { createImageDestination, saveImageMetadata } from '@/lib/image-files';
import { getStoredModelUri, loadModels, StoredModel } from '@/lib/model-files';
import { useOperationStore } from '@/stores/use-operation-store';

export default function GenerateScreen() {
  const colors = useTheme();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [availableModels, setAvailableModels] = useState<StoredModel[]>([]);
  const [model, setModel] = useState<StoredModel | null>(null);
  const [showModels, setShowModels] = useState(false);
  const [taesd, setTaesd] = useState<StoredModel | null>(null);
  const [showTaesd, setShowTaesd] = useState(false);
  const [loras, setLoras] = useState<LoraSelection[]>([]);
  const [showLoraPicker, setShowLoraPicker] = useState(false);
  const [steps, setSteps] = useState(4);
  const [imageSize, setImageSize] = useState<ImageSizeOption>(IMAGE_SIZE_OPTIONS[2]);
  const [sampler, setSampler] = useState<SamplingPreset>('lcm');
  const [cfgScale, setCfgScale] = useState<number>(1.0);
  const [seed, setSeed] = useState<number>(-1);
  const [isFixedSeed, setIsFixedSeed] = useState<boolean>(false);
  const [upscalerType, setUpscalerType] = useState<BuiltInUpscalerType>('none');
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [hiresSteps, setHiresSteps] = useState(4);
  const [hiresDenoisingStrength, setHiresDenoisingStrength] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgressEvent | null>(null);
  const activeOperation = useOperationStore((state) => state.activeOperation);
  const tryStartOperation = useOperationStore((state) => state.tryStartOperation);
  const finishOperation = useOperationStore((state) => state.finishOperation);

  useFocusEffect(
    useCallback(() => {
      loadModels()
        .then((models) => {
          setAvailableModels(models);
          setModel((current) => models.find(({ id }) => id === current?.id) ?? null);
          setTaesd((current) => models.find(({ id }) => id === current?.id) ?? null);
          setLoras((current) =>
            current.flatMap((lora) => {
              const stored = models.find(({ id }) => id === lora.model.id);
              return stored ? [{ ...lora, model: stored }] : [];
            }),
          );
        })
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : '모델 목록을 불러오지 못했습니다.'),
        );
    }, []),
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || !model) return;
    const operation = tryStartOperation({ kind: 'generation', label: '이미지 생성' });
    if (!operation) {
      const active = useOperationStore.getState().activeOperation;
      if (active) showOperationBlockedAlert(active, '이미지 생성');
      else Alert.alert('이미지 생성을 시작하지 못했습니다', '잠시 후 다시 시도해 주세요.');
      return;
    }
    const generationSeed = seed < 0 ? Math.floor(Math.random() * 2_147_483_647) : seed;
    setIsGenerating(true);
    setError(null);
    setProgress({ stage: 'loading' });
    let destination: ReturnType<typeof createImageDestination> | null = null;
    let progressSubscription: ReturnType<typeof addProgressListener> | null = null;
    try {
      destination = createImageDestination({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model: { id: model.id, name: model.alias, storedFileName: model.storedFileName },
        decoder: taesd
          ? {
              type: 'taesd',
              model: { id: taesd.id, name: taesd.alias, storedFileName: taesd.storedFileName },
            }
          : { type: 'vae' },
        loras: loras.map(({ model: lora, weight }) => ({
          id: lora.id,
          name: lora.alias,
          storedFileName: lora.storedFileName,
          weight,
        })),
        width: imageSize.width,
        height: imageSize.height,
        samplingPreset: sampler,
        steps,
        cfgScale,
        seed: generationSeed,
        upscaler: {
          type: upscalerType,
          scale: upscaleFactor,
          steps: hiresSteps,
          denoisingStrength: hiresDenoisingStrength,
        },
      });
      progressSubscription = addProgressListener(setProgress);
      const uri = await generateImage({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        modelUri: getStoredModelUri(model),
        taesdUri: taesd ? getStoredModelUri(taesd) : undefined,
        loras: loras.map(({ model: lora, weight }) => ({
          uri: getStoredModelUri(lora),
          weight,
        })),
        width: imageSize.width,
        height: imageSize.height,
        samplingPreset: sampler,
        steps,
        cfgScale,
        seed: generationSeed,
        upscaler: {
          type: upscalerType,
          scale: upscaleFactor,
          steps: hiresSteps,
          denoisingStrength: hiresDenoisingStrength,
        },
        outputUri: destination.file.uri,
      });
      try {
        await saveImageMetadata(destination.metadata);
      } catch (reason) {
        console.warn('이미지 메타데이터를 저장하지 못했습니다.', reason);
        setError('이미지는 저장했지만 생성 정보를 기록하지 못했습니다.');
      }
      setImageUri(uri);
    } catch (reason) {
      if (destination?.file.exists) destination.file.delete();
      setError(reason instanceof Error ? reason.message : '이미지를 생성하지 못했습니다.');
    } finally {
      progressSubscription?.remove();
      finishOperation(operation.id);
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <RNText accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              이미지 생성
            </RNText>
          </View>

          <View
            style={[
              styles.preview,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {isGenerating ? (
              <View style={styles.previewEmpty}>
                <ActivityIndicator color={colors.accent} size="large" />
                <GenerationProgress progress={progress} />
              </View>
            ) : imageUri ? (
              <Image
                source={{ uri: imageUri }}
                resizeMode="contain"
                style={styles.generatedImage}
              />
            ) : (
              <View style={styles.previewEmpty}>
                <View style={[styles.sparkle, { backgroundColor: colors.accentSoft }]}>
                  <Sparkles color={colors.accentIcon} size={20} />
                </View>
                <RNText style={[styles.previewTitle, { color: colors.text }]}>
                  첫 이미지를 만들어 보세요
                </RNText>
                <RNText style={[styles.previewCaption, { color: colors.muted }]}>
                  자세히 설명할수록 원하는 결과에 가까워집니다.
                </RNText>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <RNText style={[styles.label, { color: colors.text }]}>프롬프트</RNText>
              <RNText style={[styles.counter, { color: colors.muted }]}>
                {prompt.length}/1000
              </RNText>
            </View>
            <TextInput
              accessibilityLabel="이미지 프롬프트"
              maxLength={1000}
              multiline
              onChangeText={setPrompt}
              placeholder="예: 안개 낀 새벽 숲속의 작은 오두막, 따뜻한 불빛, 시네마틱"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.promptInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                },
              ]}
              textAlignVertical="top"
              value={prompt}
            />
          </View>

          <View style={styles.section}>
            <RNText style={[styles.label, { color: colors.text }]}>모델</RNText>
            <Pressable
              accessibilityHint="사용할 모델 목록을엽니다"
              accessibilityRole="button"
              onPress={() => setShowModels(true)}
              style={({ pressed }) => [
                styles.select,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.modelIcon, { backgroundColor: colors.accentSoft }]}>
                <Box color={colors.accentIcon} size={18} />
              </View>
              <View style={styles.selectText}>
                <RNText numberOfLines={1} style={[styles.selectValue, { color: colors.text }]}>
                  {model?.alias ?? '모델을 선택하세요'}
                </RNText>
                {Boolean(model) && (
                  <RNText style={[styles.selectHint, { color: colors.muted }]}>
                    {formatModelInfo(model!)}
                  </RNText>
                )}
              </View>
              <ChevronRight color={colors.muted} size={20} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <RNText style={[styles.label, { color: colors.text }]}>LoRA</RNText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowLoraPicker(true)}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: colors.accentSoft },
                  pressed && styles.pressed,
                ]}
              >
                <Plus color={colors.accentText} size={14} strokeWidth={2.5} />
                <RNText style={[styles.addButtonText, { color: colors.accentText }]}>추가</RNText>
              </Pressable>
            </View>
            <LoraSortableList loras={loras} onChange={setLoras} />
          </View>

          <AdvancedGenerationOptions
            cfgScale={cfgScale}
            imageSize={imageSize}
            isFixedSeed={isFixedSeed}
            hiresDenoisingStrength={hiresDenoisingStrength}
            hiresSteps={hiresSteps}
            negativePrompt={negativePrompt}
            onChangeCfgScale={setCfgScale}
            onChangeHiresDenoisingStrength={setHiresDenoisingStrength}
            onChangeHiresSteps={setHiresSteps}
            onChangeNegativePrompt={setNegativePrompt}
            onChangeSeed={setSeed}
            onChangeUpscaleFactor={setUpscaleFactor}
            onOpenTaesdPicker={() => setShowTaesd(true)}
            onSelectImageSize={setImageSize}
            onSelectSampler={setSampler}
            onSelectUpscaler={setUpscalerType}
            onToggleFixedSeed={setIsFixedSeed}
            sampler={sampler}
            seed={seed}
            taesd={taesd}
            upscaleFactor={upscaleFactor}
            upscalerType={upscalerType}
          />

          {error && (
            <RNText accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
              {error}
            </RNText>
          )}
        </ScrollView>

        <GenerationControls
          canGenerate={Boolean(prompt.trim() && model)}
          isBlocked={Boolean(activeOperation && activeOperation.kind !== 'generation')}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onStepsChange={setSteps}
          steps={steps}
        />
      </KeyboardAvoidingView>

      <ModelPicker
        models={availableModels}
        onClose={() => setShowModels(false)}
        onSelect={(selected) => {
          setModel(selected);
          setShowModels(false);
        }}
        selected={model}
        visible={showModels}
      />
      <LoraPicker
        onChange={setLoras}
        onClose={() => setShowLoraPicker(false)}
        options={availableModels}
        selected={loras}
        visible={showLoraPicker}
      />
      <ModelPicker
        defaultOptionLabel="기본 디코더 사용"
        models={availableModels}
        onClose={() => setShowTaesd(false)}
        onSelect={(selected) => {
          setTaesd(selected);
          setShowTaesd(false);
        }}
        selected={taesd}
        title="디코더 선택"
        visible={showTaesd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 190, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  preview: {
    height: 200,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  previewEmpty: { alignItems: 'center', gap: 8, padding: 24 },
  sparkle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginBottom: 2,
  },
  previewTitle: { fontSize: 16, fontWeight: '600' },
  previewCaption: { fontSize: 13, textAlign: 'center' },
  progressBlock: { alignItems: 'center', gap: 8 },
  progressStages: { flexDirection: 'row', alignItems: 'center' },
  progressStage: { fontSize: 12, fontWeight: '600' },
  progressArrow: { fontSize: 12, marginHorizontal: 5 },
  progressDetail: { fontSize: 14, fontWeight: '600' },
  generatedImage: { width: '100%', height: '100%' },
  section: { gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600' },
  counter: { fontSize: 12 },
  promptInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
  },
  select: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  modelIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  selectText: { flex: 1, gap: 3 },
  selectValue: { fontSize: 14, fontWeight: '600' },
  selectHint: { fontSize: 12 },
  addButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 12,
  },
  addButtonText: { fontSize: 13, fontWeight: '600' },
  error: { fontSize: 13 },
  pressed: { opacity: 0.72 },
});

const GENERATION_STAGES: { stage: GenerationProgressEvent['stage']; label: string }[] = [
  { stage: 'loading', label: 'Loading' },
  { stage: 'encoding', label: 'Encoding' },
  { stage: 'sampling', label: 'Steps' },
  { stage: 'decoding', label: 'Decoding' },
];

function GenerationProgress({ progress }: { progress: GenerationProgressEvent | null }) {
  const colors = useTheme();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const current = Math.max(
    0,
    GENERATION_STAGES.findIndex(({ stage }) => stage === progress?.stage),
  );
  const step = progress?.step ?? 0;
  const steps = progress?.steps ?? 0;
  const currentProgress = progress ?? { stage: 'loading' };
  const detail = generationProgressDetail(currentProgress, elapsedSeconds);
  const accessibilityLabel =
    currentProgress.stage === 'sampling'
      ? `Steps ${step}/${steps}`
      : GENERATION_STAGES[current].label;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.progressBlock}
    >
      <View accessible={false} style={styles.progressStages}>
        {GENERATION_STAGES.map(({ stage, label }, index) => (
          <View key={stage} style={styles.progressStages}>
            {index > 0 && (
              <RNText style={[styles.progressArrow, { color: colors.border }]}>›</RNText>
            )}
            <RNText
              style={[
                styles.progressStage,
                {
                  color:
                    index === current
                      ? colors.accentText
                      : index < current
                        ? colors.textSecondary
                        : colors.muted,
                },
              ]}
            >
              {label}
            </RNText>
          </View>
        ))}
      </View>
      <RNText style={[styles.progressDetail, { color: colors.text }]}>{detail}</RNText>
    </View>
  );
}
