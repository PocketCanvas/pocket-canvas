import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
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

import { GenerationControls } from '@/components/generation-controls';
import { LoraPicker, ModelPicker } from '@/components/generation-pickers';
import { LoraSelection, LoraSortableList } from '@/components/lora-sortable-list';
import { Colors } from '@/constants/theme';
import { createImageDestination, saveImageMetadata } from '@/lib/image-files';
import { getStoredModelUri, loadModels, StoredModel } from '@/lib/model-files';

export default function GenerateScreen() {
  const [prompt, setPrompt] = useState('');
  const [availableModels, setAvailableModels] = useState<StoredModel[]>([]);
  const [model, setModel] = useState<StoredModel | null>(null);
  const [showModels, setShowModels] = useState(false);
  const [taesd, setTaesd] = useState<StoredModel | null>(null);
  const [showTaesd, setShowTaesd] = useState(false);
  const [loras, setLoras] = useState<LoraSelection[]>([]);
  const [showLoraPicker, setShowLoraPicker] = useState(false);
  const [steps, setSteps] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgressEvent | null>(null);

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
    setIsGenerating(true);
    setError(null);
    setProgress({ stage: 'loading' });
    let destination: ReturnType<typeof createImageDestination> | null = null;
    let progressSubscription: ReturnType<typeof addProgressListener> | null = null;
    try {
      destination = createImageDestination({
        prompt: prompt.trim(),
        model: { id: model.id, name: model.alias, storedFileName: model.storedFileName },
        loras: loras.map(({ model: lora, weight }) => ({
          id: lora.id,
          name: lora.alias,
          storedFileName: lora.storedFileName,
          weight,
        })),
        steps,
      });
      progressSubscription = addProgressListener(setProgress);
      const uri = await generateImage({
        prompt: prompt.trim(),
        modelUri: getStoredModelUri(model),
        taesdUri: taesd ? getStoredModelUri(taesd) : undefined,
        loras: loras.map(({ model: lora, weight }) => ({
          uri: getStoredModelUri(lora),
          weight,
        })),
        steps,
        outputUri: destination.file.uri,
      });
      setImageUri(uri);
      try {
        await saveImageMetadata(destination.metadata);
      } catch (reason) {
        console.warn('이미지 메타데이터를 저장하지 못했습니다.', reason);
      }
    } catch (reason) {
      if (destination?.file.exists) destination.file.delete();
      setError(reason instanceof Error ? reason.message : '이미지를 생성하지 못했습니다.');
    } finally {
      progressSubscription?.remove();
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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
            <View>
              <RNText accessibilityRole="header" style={styles.title}>
                이미지 생성
              </RNText>
              <RNText style={styles.subtitle}>기기 안에서 빠르고 안전하게</RNText>
            </View>
          </View>

          <View style={styles.preview}>
            {isGenerating ? (
              <View style={styles.previewEmpty}>
                <ActivityIndicator color={Colors.dark.accent} size="large" />
                <GenerationProgress progress={progress} />
              </View>
            ) : imageUri ? (
              <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.generatedImage} />
            ) : (
              <View style={styles.previewEmpty}>
                <View style={styles.sparkle}>
                  <RNText style={styles.sparkleText}>✦</RNText>
                </View>
                <RNText style={styles.previewTitle}>첫 이미지를 만들어 보세요</RNText>
                <RNText style={styles.previewCaption}>
                  자세히 설명할수록 원하는 결과에 가까워집니다.
                </RNText>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <RNText style={styles.label}>경량 디코더 (TAESD)</RNText>
            <Pressable
              accessibilityHint="TAESD 가중치 목록을 엽니다"
              accessibilityRole="button"
              onPress={() => setShowTaesd(true)}
              style={({ pressed }) => [styles.select, pressed && styles.pressed]}
            >
              <View style={styles.modelIcon}>
                <RNText style={styles.modelIconText}>⚡</RNText>
              </View>
              <View style={styles.selectText}>
                <RNText numberOfLines={1} style={styles.selectValue}>
                  {taesd?.alias ?? '기본 VAE 사용'}
                </RNText>
                <RNText style={styles.selectHint}>선택 사항 · 빠른 디코딩, 낮은 품질</RNText>
              </View>
              <RNText style={styles.chevron}>›</RNText>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <RNText style={styles.label}>프롬프트</RNText>
              <RNText style={styles.counter}>{prompt.length}/500</RNText>
            </View>
            <TextInput
              accessibilityLabel="이미지 프롬프트"
              maxLength={500}
              multiline
              onChangeText={setPrompt}
              placeholder="예: 안개 낀 새벽 숲속의 작은 오두막, 따뜻한 불빛, 시네마틱"
              placeholderTextColor={Colors.dark.placeholder}
              style={styles.promptInput}
              textAlignVertical="top"
              value={prompt}
            />
          </View>

          <View style={styles.section}>
            <RNText style={styles.label}>모델</RNText>
            <Pressable
              accessibilityHint="사용할 모델 목록을 엽니다"
              accessibilityRole="button"
              onPress={() => setShowModels(true)}
              style={({ pressed }) => [styles.select, pressed && styles.pressed]}
            >
              <View style={styles.modelIcon}>
                <RNText style={styles.modelIconText}>◇</RNText>
              </View>
              <View style={styles.selectText}>
                <RNText numberOfLines={1} style={styles.selectValue}>
                  {model?.alias ?? '모델을 선택하세요'}
                </RNText>
                <RNText style={styles.selectHint}>Stable Diffusion 모델</RNText>
              </View>
              <RNText style={styles.chevron}>›</RNText>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <RNText style={styles.label}>LoRA</RNText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowLoraPicker(true)}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <RNText style={styles.addButtonText}>+ 추가</RNText>
              </Pressable>
            </View>
            <LoraSortableList loras={loras} onChange={setLoras} />
          </View>

          {error && (
            <RNText accessibilityRole="alert" style={styles.error}>
              {error}
            </RNText>
          )}
        </ScrollView>

        <GenerationControls
          canGenerate={Boolean(prompt.trim() && model)}
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
  screen: { flex: 1, backgroundColor: Colors.dark.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 190, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Colors.dark.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: Colors.dark.muted, fontSize: 13, marginTop: 4 },
  preview: {
    height: 200,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
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
    backgroundColor: Colors.dark.accentSoft,
    marginBottom: 2,
  },
  sparkleText: { color: Colors.dark.accentIcon, fontSize: 20 },
  previewTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '600' },
  previewCaption: { color: Colors.dark.muted, fontSize: 13, textAlign: 'center' },
  progressBlock: { alignItems: 'center', gap: 8 },
  progressStages: { flexDirection: 'row', alignItems: 'center' },
  progressStage: { color: Colors.dark.muted, fontSize: 12, fontWeight: '600' },
  progressStageActive: { color: Colors.dark.accentText },
  progressStageDone: { color: Colors.dark.textSecondary },
  progressArrow: { color: Colors.dark.border, fontSize: 12, marginHorizontal: 5 },
  progressDetail: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  generatedImage: { width: '100%', height: '100%' },
  section: { gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  counter: { color: Colors.dark.muted, fontSize: 12 },
  promptInput: {
    minHeight: 120,
    borderRadius: 12,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    backgroundColor: Colors.dark.surface,
    color: Colors.dark.text,
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
    borderColor: Colors.dark.border,
    borderWidth: 1,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 14,
  },
  modelIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: Colors.dark.accentSoft,
  },
  modelIconText: { color: Colors.dark.accentIcon, fontSize: 23 },
  selectText: { flex: 1, gap: 3 },
  selectValue: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  selectHint: { color: Colors.dark.muted, fontSize: 12 },
  chevron: { color: Colors.dark.muted, fontSize: 27 },
  addButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: Colors.dark.accentSoft,
    paddingHorizontal: 12,
  },
  addButtonText: { color: Colors.dark.accentText, fontSize: 13, fontWeight: '600' },
  error: { color: Colors.dark.error, fontSize: 13 },
  pressed: { opacity: 0.72 },
});

const GENERATION_STAGES: { stage: GenerationProgressEvent['stage']; label: string }[] = [
  { stage: 'loading', label: 'Loading' },
  { stage: 'encoding', label: 'Encoding' },
  { stage: 'sampling', label: 'Steps' },
  { stage: 'decoding', label: 'Decoding' },
];

function GenerationProgress({ progress }: { progress: GenerationProgressEvent | null }) {
  const current = Math.max(
    0,
    GENERATION_STAGES.findIndex(({ stage }) => stage === progress?.stage),
  );
  const step = progress?.step ?? 0;
  const steps = progress?.steps ?? 0;
  const detail =
    progress?.stage === 'loading' && steps > 0
      ? `Loading ${Math.min(100, Math.round((step / steps) * 100))}%`
      : progress?.stage === 'sampling'
        ? `Steps ${step}/${steps}`
        : GENERATION_STAGES[current].label;

  return (
    <View
      accessibilityLabel={detail}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.progressBlock}
    >
      <View accessible={false} style={styles.progressStages}>
        {GENERATION_STAGES.map(({ stage, label }, index) => (
          <View key={stage} style={styles.progressStages}>
            {index > 0 && <RNText style={styles.progressArrow}>›</RNText>}
            <RNText
              style={[
                styles.progressStage,
                index < current && styles.progressStageDone,
                index === current && styles.progressStageActive,
              ]}
            >
              {label}
            </RNText>
          </View>
        ))}
      </View>
      <RNText style={styles.progressDetail}>{detail}</RNText>
    </View>
  );
}
