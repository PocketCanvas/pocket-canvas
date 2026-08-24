import { Box, ChevronRight, Plus, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useReducer, useState } from 'react';
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
import { addProgressListener, generateImage, GenerationProgressEvent } from 'stable-diffusion';
import { AdvancedGenerationOptions } from '@/components/generate/advanced-generation-options';
import { GenerationControls } from '@/components/generate/generation-controls';
import { formatModelInfo, LoraPicker, ModelPicker } from '@/components/generate/generation-pickers';
import { LoraSortableList } from '@/components/generate/lora-sortable-list';
import { useModelCatalog } from '@/hooks/use-model-catalog';
import { useTheme } from '@/hooks/use-theme';
import { createInitialGenerationDraft, generationDraftReducer } from '@/lib/generation-draft';
import { generationProgressDetail } from '@/lib/generation-progress';
import {
  createInitialGenerationRunState,
  generationRunReducer,
  visibleGenerationImageUri,
} from '@/lib/generation-state';
import { showOperationBlockedAlert } from '@/lib/heavy-operation';
import { createImageDestination, saveImageMetadata } from '@/lib/image-files';
import {
  getStoredModelUri,
  inspectStoredModelDescriptor,
  type StoredModel,
} from '@/lib/model-files';
import { useOperationStore } from '@/stores/use-operation-store';

export default function GenerateScreen() {
  const colors = useTheme();
  const [openPicker, setOpenPicker] = useState<'model' | 'taesd' | 'lora' | null>(null);
  const [draft, dispatchDraft] = useReducer(
    generationDraftReducer,
    undefined,
    createInitialGenerationDraft,
  );
  const [runState, dispatchRun] = useReducer(
    generationRunReducer,
    undefined,
    createInitialGenerationRunState,
  );
  const isGenerating = runState.status === 'running';
  const imageUri = visibleGenerationImageUri(runState);
  const progress = runState.status === 'running' ? runState.progress : null;
  const generationMessage =
    runState.status === 'failed'
      ? runState.error
      : runState.status === 'succeeded'
        ? runState.warning
        : null;
  const { prompt, negativePrompt, resources, sampling, imageSize, seed, hires } = draft;
  const { model, taesd, loras } = resources;
  const activeOperation = useOperationStore((state) => state.activeOperation);
  const tryStartOperation = useOperationStore((state) => state.tryStartOperation);
  const finishOperation = useOperationStore((state) => state.finishOperation);
  const reconcileResources = useCallback(
    (availableModels: StoredModel[]) =>
      dispatchDraft({ type: 'resourcesReconciled', availableModels }),
    [],
  );
  const { models: availableModels, error: modelLoadError } = useModelCatalog(reconcileResources);

  const handleGenerate = async () => {
    if (!prompt.trim() || !model) return;
    const operation = tryStartOperation({ kind: 'generation', label: '이미지 생성' });
    if (!operation) {
      const active = useOperationStore.getState().activeOperation;
      if (active) showOperationBlockedAlert(active, '이미지 생성');
      else Alert.alert('이미지 생성을 시작하지 못했습니다', '잠시 후 다시 시도해 주세요.');
      return;
    }
    const generationSeed = seed.value < 0 ? Math.floor(Math.random() * 2_147_483_647) : seed.value;
    dispatchRun({ type: 'started' });
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
        samplingPreset: sampling.preset,
        steps: sampling.steps,
        cfgScale: sampling.cfgScale,
        seed: generationSeed,
        upscaler: {
          type: hires.type,
          scale: hires.scale,
          steps: hires.steps,
          denoisingStrength: hires.denoisingStrength,
        },
      });
      progressSubscription = addProgressListener((nextProgress) =>
        dispatchRun({ type: 'progressed', progress: nextProgress }),
      );
      const modelDescriptor = inspectStoredModelDescriptor(model);
      const uri = await generateImage({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        modelUri: getStoredModelUri(model),
        taesdUri: taesd ? getStoredModelUri(taesd) : undefined,
        memoryModel: {
          family: modelDescriptor.family.value,
          familyEvidence: modelDescriptor.family.evidence,
          variant: modelDescriptor.variant.value,
          variantEvidence: modelDescriptor.variant.evidence,
          diffusionStorage: modelDescriptor.storage.diffusion.dominantType,
          diffusionBytes: modelDescriptor.storage.diffusion.estimatedBytes,
          vaeArchitecture:
            modelDescriptor.storage.vae.tensorCount > 0 ? 'autoencoder-kl' : 'unknown',
        },
        loras: loras.map(({ model: lora, weight }) => ({
          uri: getStoredModelUri(lora),
          weight,
        })),
        width: imageSize.width,
        height: imageSize.height,
        samplingPreset: sampling.preset,
        steps: sampling.steps,
        cfgScale: sampling.cfgScale,
        seed: generationSeed,
        upscaler: {
          type: hires.type,
          scale: hires.scale,
          steps: hires.steps,
          denoisingStrength: hires.denoisingStrength,
        },
        outputUri: destination.file.uri,
      });
      let warning: string | undefined;
      try {
        await saveImageMetadata(destination.metadata);
      } catch (reason) {
        console.warn('이미지 메타데이터를 저장하지 못했습니다.', reason);
        warning = '이미지는 저장했지만 생성 정보를 기록하지 못했습니다.';
      }
      dispatchRun({ type: 'succeeded', imageUri: uri, warning });
    } catch (reason) {
      if (destination?.file.exists) destination.file.delete();
      dispatchRun({
        type: 'failed',
        error: reason instanceof Error ? reason.message : '이미지를 생성하지 못했습니다.',
      });
    } finally {
      progressSubscription?.remove();
      finishOperation(operation.id);
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
              onChangeText={(value) => dispatchDraft({ type: 'promptChanged', value })}
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
              onPress={() => setOpenPicker('model')}
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
                onPress={() => setOpenPicker('lora')}
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
            <LoraSortableList
              loras={loras}
              onChange={(nextLoras) => dispatchDraft({ type: 'lorasChanged', loras: nextLoras })}
            />
          </View>

          <AdvancedGenerationOptions
            cfgScale={sampling.cfgScale}
            imageSize={imageSize}
            isFixedSeed={seed.fixed}
            hiresDenoisingStrength={hires.denoisingStrength}
            hiresSteps={hires.steps}
            negativePrompt={negativePrompt}
            onChangeCfgScale={(cfgScale) =>
              dispatchDraft({ type: 'samplingChanged', changes: { cfgScale } })
            }
            onChangeHiresDenoisingStrength={(denoisingStrength) =>
              dispatchDraft({ type: 'hiresChanged', changes: { denoisingStrength } })
            }
            onChangeHiresSteps={(steps) =>
              dispatchDraft({ type: 'hiresChanged', changes: { steps } })
            }
            onChangeNegativePrompt={(value) =>
              dispatchDraft({ type: 'negativePromptChanged', value })
            }
            onChangeSeed={(value) => dispatchDraft({ type: 'seedChanged', value })}
            onChangeUpscaleFactor={(scale) =>
              dispatchDraft({ type: 'hiresChanged', changes: { scale } })
            }
            onOpenTaesdPicker={() => setOpenPicker('taesd')}
            onSelectImageSize={(nextImageSize) =>
              dispatchDraft({ type: 'imageSizeSelected', imageSize: nextImageSize })
            }
            onSelectSampler={(preset) =>
              dispatchDraft({ type: 'samplingChanged', changes: { preset } })
            }
            onSelectUpscaler={(type) => dispatchDraft({ type: 'hiresChanged', changes: { type } })}
            onToggleFixedSeed={(fixed) => dispatchDraft({ type: 'fixedSeedToggled', fixed })}
            sampler={sampling.preset}
            seed={seed.value}
            taesd={taesd}
            upscaleFactor={hires.scale}
            upscalerType={hires.type}
          />

          {(modelLoadError || generationMessage) && (
            <RNText accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
              {modelLoadError ?? generationMessage}
            </RNText>
          )}
        </ScrollView>

        <GenerationControls
          canGenerate={Boolean(prompt.trim() && model)}
          isBlocked={Boolean(activeOperation && activeOperation.kind !== 'generation')}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onStepsChange={(steps) => dispatchDraft({ type: 'samplingChanged', changes: { steps } })}
          steps={sampling.steps}
        />
      </KeyboardAvoidingView>

      <ModelPicker
        models={availableModels}
        onClose={() => setOpenPicker(null)}
        onSelect={(selected) => {
          dispatchDraft({ type: 'modelSelected', model: selected });
          setOpenPicker(null);
        }}
        selected={model}
        visible={openPicker === 'model'}
      />
      <LoraPicker
        onChange={(nextLoras) => dispatchDraft({ type: 'lorasChanged', loras: nextLoras })}
        onClose={() => setOpenPicker(null)}
        options={availableModels}
        selected={loras}
        visible={openPicker === 'lora'}
      />
      <ModelPicker
        defaultOptionLabel="기본 디코더 사용"
        models={availableModels}
        onClose={() => setOpenPicker(null)}
        onSelect={(selected) => {
          dispatchDraft({ type: 'taesdSelected', taesd: selected });
          setOpenPicker(null);
        }}
        selected={taesd}
        title="디코더 선택"
        visible={openPicker === 'taesd'}
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
