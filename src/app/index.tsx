import { useState } from 'react';
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
import { generateImage } from 'stable-diffusion';

import { GenerationControls } from '@/components/generation-controls';
import { LoraPicker, ModelPicker } from '@/components/generation-pickers';
import { LoraSelection, LoraSortableList } from '@/components/lora-sortable-list';
import { Colors } from '@/constants/theme';

const MODELS = ['SD 2.1', 'SD 1.5 Q4_K'];
const AVAILABLE_LORAS = ['Cartoon Style LoRA', 'Detail Enhancer', 'LCM-LoRA SD 1.5'];

export default function GenerateScreen() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [showModels, setShowModels] = useState(false);
  const [loras, setLoras] = useState<LoraSelection[]>([]);
  const [showLoraPicker, setShowLoraPicker] = useState(false);
  const [steps, setSteps] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const uri = await generateImage(prompt.trim());
      if (uri.startsWith('Error')) setError(uri);
      else setImageUri(uri);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '이미지를 생성하지 못했습니다.');
    } finally {
      setIsGenerating(false);
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
                <RNText style={styles.previewCaption}>이미지를 그리고 있어요</RNText>
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
                  {model}
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
          canGenerate={Boolean(prompt.trim())}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onStepsChange={setSteps}
          steps={steps}
        />
      </KeyboardAvoidingView>

      <ModelPicker
        models={MODELS}
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
        options={AVAILABLE_LORAS}
        selected={loras}
        visible={showLoraPicker}
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
