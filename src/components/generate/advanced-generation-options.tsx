import { Host } from '@expo/ui/jetpack-compose';
import { ChevronDown, ChevronRight, Dices, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CompactSlider } from '@/components/common/compact-slider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { StoredModel } from '@/lib/model-files';
import type { BuiltInUpscalerType, SamplingPreset } from 'stable-diffusion';

export type ImageSizeOption = {
  label: string;
  width: number;
  height: number;
  warning?: string;
};

export const IMAGE_SIZE_OPTIONS: ImageSizeOption[] = [
  { label: '256×256', width: 256, height: 256 },
  { label: '384×384', width: 384, height: 384 },
  { label: '512×512', width: 512, height: 512 },
  {
    label: '768×768',
    width: 768,
    height: 768,
    warning: '768×768 해상도는 모바일 기기 메모리 및 발열에 큰 부담이 될 수 있습니다.',
  },
];

export const SAMPLER_OPTIONS: readonly [SamplingPreset, string][] = [
  ['euler', 'Euler'],
  ['euler_a', 'Euler a'],
  ['heun', 'Heun'],
  ['dpm2', 'DPM2'],
  ['dpmpp_2s_a', 'DPM++ 2S a'],
  ['dpmpp_2m', 'DPM++ 2M'],
  ['dpmpp_2m_karras', 'DPM++ 2M Karras'],
  ['dpmpp_2m_v2', 'DPM++ 2M v2'],
  ['ipndm', 'IPNDM'],
  ['ipndm_v', 'IPNDM V'],
  ['lcm', 'LCM'],
  ['ddim', 'DDIM'],
  ['tcd', 'TCD'],
  ['res_multistep', 'RES Multistep'],
  ['res_2s', 'RES 2S'],
  ['er_sde', 'ER-SDE'],
  ['euler_cfg_pp', 'Euler CFG++'],
  ['euler_a_cfg_pp', 'Euler a CFG++'],
  ['euler_ge', 'Euler GE'],
  ['dpmpp_2m_sde', 'DPM++ 2M SDE'],
  ['dpmpp_2m_sde_karras', 'DPM++ 2M SDE Karras'],
  ['dpmpp_2m_sde_bt', 'DPM++ 2M SDE BT'],
  ['lms', 'LMS'],
];

const UPSCALER_OPTIONS: readonly [BuiltInUpscalerType, string][] = [
  ['none', '사용 안 함'],
  ['latent', 'Latent'],
  ['latent_nearest', 'Latent Nearest'],
  ['latent_nearest_exact', 'Latent Nearest Exact'],
  ['latent_antialiased', 'Latent Antialiased'],
  ['latent_bicubic', 'Latent Bicubic'],
  ['latent_bicubic_antialiased', 'Latent Bicubic Antialiased'],
  ['lanczos', 'Lanczos'],
  ['nearest', 'Nearest'],
];

type AdvancedGenerationOptionsProps = {
  negativePrompt: string;
  onChangeNegativePrompt: (value: string) => void;
  taesd: StoredModel | null;
  onOpenTaesdPicker: () => void;
  imageSize: ImageSizeOption;
  onSelectImageSize: (size: ImageSizeOption) => void;
  upscalerType: BuiltInUpscalerType;
  onSelectUpscaler: (type: BuiltInUpscalerType) => void;
  upscaleFactor: number;
  onChangeUpscaleFactor: (value: number) => void;
  hiresSteps: number;
  onChangeHiresSteps: (value: number) => void;
  hiresDenoisingStrength: number;
  onChangeHiresDenoisingStrength: (value: number) => void;
  sampler: SamplingPreset;
  onSelectSampler: (sampler: SamplingPreset) => void;
  cfgScale: number;
  onChangeCfgScale: (value: number) => void;
  seed: number;
  onChangeSeed: (seed: number) => void;
  isFixedSeed: boolean;
  onToggleFixedSeed: (enabled: boolean) => void;
};

export function AdvancedGenerationOptions({
  negativePrompt,
  onChangeNegativePrompt,
  taesd,
  onOpenTaesdPicker,
  imageSize,
  onSelectImageSize,
  upscalerType,
  onSelectUpscaler,
  upscaleFactor,
  onChangeUpscaleFactor,
  hiresSteps,
  onChangeHiresSteps,
  hiresDenoisingStrength,
  onChangeHiresDenoisingStrength,
  sampler,
  onSelectSampler,
  cfgScale,
  onChangeCfgScale,
  seed,
  onChangeSeed,
  isFixedSeed,
  onToggleFixedSeed,
}: AdvancedGenerationOptionsProps) {
  const colors = useTheme();
  const colorScheme = useColorScheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [showSamplerModal, setShowSamplerModal] = useState(false);
  const [showUpscalerModal, setShowUpscalerModal] = useState(false);
  const samplerLabel = SAMPLER_OPTIONS.find(([value]) => value === sampler)?.[1] ?? sampler;
  const upscalerLabel = UPSCALER_OPTIONS.find(([value]) => value === upscalerType)?.[1];

  const handleRandomizeSeed = () => {
    const randomSeed = Math.floor(Math.random() * 2147483647);
    onChangeSeed(randomSeed);
    if (!isFixedSeed) {
      onToggleFixedSeed(true);
    }
  };

  const handleToggleFixedSeed = (enabled: boolean) => {
    onToggleFixedSeed(enabled);
    if (enabled && seed === -1) {
      onChangeSeed(Math.floor(Math.random() * 2147483647));
    } else if (!enabled) {
      onChangeSeed(-1);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityHint="고급 출력 설정 옵션을 열거나 닫습니다"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((prev) => !prev)}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>고급 옵션</Text>
        {isExpanded ? (
          <ChevronDown color={colors.muted} size={20} />
        ) : (
          <ChevronRight color={colors.muted} size={20} />
        )}
      </Pressable>

      {isExpanded && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.negativePromptSection,
              styles.borderBottom,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.fieldHeader}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>네거티브 프롬프트</Text>
              <Text style={[styles.fieldCounter, { color: colors.muted }]}>
                {negativePrompt.length}/1000
              </Text>
            </View>
            <TextInput
              accessibilityLabel="네거티브 프롬프트"
              maxLength={1000}
              multiline
              onChangeText={onChangeNegativePrompt}
              placeholder="예: blurry, low quality"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.negativePromptInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              textAlignVertical="top"
              value={negativePrompt}
            />
          </View>

          {/* 1. 경량 디코더 (TAESD / VAE) */}
          <Pressable
            accessibilityHint="TAESD 가중치 목록을 엽니다"
            accessibilityRole="button"
            onPress={onOpenTaesdPicker}
            style={({ pressed }) => [
              styles.row,
              styles.borderBottom,
              { borderBottomColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>경량 디코더 (TAESD)</Text>
            <View style={styles.rowValueGroup}>
              <Text numberOfLines={1} style={[styles.rowValue, { color: colors.muted }]}>
                {taesd?.alias ?? '기본 VAE'}
              </Text>
              <ChevronRight color={colors.muted} size={18} />
            </View>
          </Pressable>

          {/* 2. 기본 이미지 사이즈 */}
          <View style={[styles.borderBottom, { borderBottomColor: colors.border }]}>
            <Pressable
              accessibilityHint="이미지 해상도를 선택합니다"
              accessibilityRole="button"
              onPress={() => setShowSizeModal(true)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>기본 이미지 사이즈</Text>
              <View style={styles.rowValueGroup}>
                <Text
                  style={[
                    styles.rowValue,
                    { color: colors.muted },
                    Boolean(imageSize.warning) && { color: colors.warning, fontWeight: '700' },
                  ]}
                >
                  {imageSize.label}
                </Text>
                <ChevronRight color={colors.muted} size={18} />
              </View>
            </Pressable>
            {Boolean(imageSize.warning) && (
              <View
                style={[
                  styles.warningBox,
                  { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
                ]}
              >
                <TriangleAlert color={colors.warning} size={15} style={styles.warningIcon} />
                <Text style={[styles.warningBoxText, { color: colors.warning }]}>
                  {imageSize.warning}
                </Text>
              </View>
            )}
          </View>

          {/* 3. 내장 Hires 업스케일러 */}
          <Pressable
            accessibilityHint="내장 업스케일 방식을 선택합니다"
            accessibilityRole="button"
            onPress={() => setShowUpscalerModal(true)}
            style={({ pressed }) => [
              styles.row,
              styles.borderBottom,
              { borderBottomColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Hires 업스케일러</Text>
            <View style={styles.rowValueGroup}>
              <Text numberOfLines={1} style={[styles.rowValue, { color: colors.muted }]}>
                {upscalerLabel}
              </Text>
              <ChevronRight color={colors.muted} size={18} />
            </View>
          </Pressable>

          {upscalerType !== 'none' && (
            <>
              <View
                style={[
                  styles.sliderSection,
                  styles.borderBottom,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.sliderHeader}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>업스케일 배율</Text>
                  <Text style={[styles.scaleValue, { color: colors.text }]}>
                    {upscaleFactor.toFixed(1)}×
                  </Text>
                </View>
                <Host colorScheme={colorScheme} seedColor={colors.accent} style={styles.sliderHost}>
                  <CompactSlider
                    max={4}
                    min={1.5}
                    onValueChange={(value) => onChangeUpscaleFactor(Math.round(value * 2) / 2)}
                    steps={4}
                    value={upscaleFactor}
                  />
                </Host>
                <View style={styles.sliderRange}>
                  <Text style={[styles.rangeText, { color: colors.muted }]}>1.5×</Text>
                  <Text style={[styles.rangeText, { color: colors.muted }]}>4.0×</Text>
                </View>
              </View>
              <View
                style={[
                  styles.sliderSection,
                  styles.borderBottom,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.sliderHeader}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Hires Steps</Text>
                  <Text style={[styles.scaleValue, { color: colors.text }]}>{hiresSteps}</Text>
                </View>
                <Host colorScheme={colorScheme} seedColor={colors.accent} style={styles.sliderHost}>
                  <CompactSlider
                    max={50}
                    min={1}
                    onValueChange={(value) => onChangeHiresSteps(Math.round(value))}
                    steps={48}
                    value={hiresSteps}
                  />
                </Host>
              </View>
              <View
                style={[
                  styles.sliderSection,
                  styles.borderBottom,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.sliderHeader}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Denoising Strength</Text>
                  <Text style={[styles.scaleValue, { color: colors.text }]}>
                    {hiresDenoisingStrength.toFixed(1)}
                  </Text>
                </View>
                <Host colorScheme={colorScheme} seedColor={colors.accent} style={styles.sliderHost}>
                  <CompactSlider
                    max={1}
                    min={0.1}
                    onValueChange={(value) =>
                      onChangeHiresDenoisingStrength(Math.round(value * 10) / 10)
                    }
                    steps={8}
                    value={hiresDenoisingStrength}
                  />
                </Host>
              </View>
            </>
          )}

          {/* 4. 샘플링 방법 */}
          <Pressable
            accessibilityHint="샘플러 알고리즘을 선택합니다"
            accessibilityRole="button"
            onPress={() => setShowSamplerModal(true)}
            style={({ pressed }) => [
              styles.row,
              styles.borderBottom,
              { borderBottomColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>샘플링 방법</Text>
            <View style={styles.rowValueGroup}>
              <Text style={[styles.rowValue, { color: colors.muted }]}>{samplerLabel}</Text>
              <ChevronRight color={colors.muted} size={18} />
            </View>
          </Pressable>

          {/* 5. CFG Scale 슬라이더 */}
          <View
            style={[
              styles.sliderSection,
              styles.borderBottom,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.sliderHeader}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>CFG Scale</Text>
              <Text style={[styles.scaleValue, { color: colors.text }]}>{cfgScale.toFixed(1)}</Text>
            </View>
            <Host colorScheme={colorScheme} seedColor={colors.accent} style={styles.sliderHost}>
              <CompactSlider
                max={20}
                min={1}
                onValueChange={(val) => onChangeCfgScale(Math.round(val * 2) / 2)}
                steps={38}
                value={cfgScale}
              />
            </Host>
            <View style={styles.sliderRange}>
              <Text style={[styles.rangeText, { color: colors.muted }]}>1.0</Text>
              <Text style={[styles.rangeText, { color: colors.muted }]}>20.0</Text>
            </View>
          </View>

          {/* 6. 시드 */}
          <View style={[styles.row, styles.borderBottom, { borderBottomColor: colors.border }]}>
            <View style={styles.seedRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>시드</Text>
              <TextInput
                accessibilityLabel="시드 입력"
                keyboardType="numeric"
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9-]/g, '');
                  if (cleaned === '' || cleaned === '-') {
                    onChangeSeed(-1);
                  } else {
                    const parsed = parseInt(cleaned, 10);
                    if (!Number.isNaN(parsed)) {
                      onChangeSeed(parsed);
                      if (!isFixedSeed && parsed !== -1) {
                        onToggleFixedSeed(true);
                      }
                    }
                  }
                }}
                placeholder="-1"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.seedInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                  },
                ]}
                value={isFixedSeed && seed !== -1 ? String(seed) : '-1'}
              />
            </View>
            <Pressable
              accessibilityHint="새로운 무작위 시드를 생성하고 고정합니다"
              accessibilityLabel="랜덤 시드 주사위"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleRandomizeSeed}
              style={({ pressed }) => [
                styles.diceButton,
                { backgroundColor: colors.accentSoft },
                pressed && styles.pressed,
              ]}
            >
              <Dices color={colors.accentText} size={20} />
            </Pressable>
          </View>

          {/* 7. 고정 시드 토글 */}
          <View style={styles.row}>
            <View style={styles.rowLabelGroup}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>고정 시드</Text>
              <Text style={[styles.rowSubLabel, { color: colors.muted }]}>
                활성화 시 동일한 시드로 재현 가능
              </Text>
            </View>
            <Switch
              accessibilityLabel="고정 시드 활성화"
              onValueChange={handleToggleFixedSeed}
              thumbColor={colors.onAccent}
              trackColor={{ false: colors.border, true: colors.accent }}
              value={isFixedSeed}
            />
          </View>
        </View>
      )}

      {/* 이미지 사이즈 선택 모달 */}
      <Modal
        animationType="fade"
        onRequestClose={() => setShowSizeModal(false)}
        transparent
        visible={showSizeModal}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.backdrop }]}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={() => setShowSizeModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>기본 이미지 사이즈</Text>
            <ScrollView style={styles.modalList}>
              {IMAGE_SIZE_OPTIONS.map((opt) => {
                const isSelected = opt.label === imageSize.label;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => {
                      onSelectImageSize(opt);
                      setShowSizeModal(false);
                    }}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <View style={styles.modalOptionRow}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          { color: isSelected ? colors.accentText : colors.textSecondary },
                          isSelected && { fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {Boolean(opt.warning) && (
                        <View
                          style={[
                            styles.warningBadge,
                            {
                              backgroundColor: colors.warningSoft,
                              borderColor: colors.warningBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.warningBadgeText, { color: colors.warning }]}>
                            주의
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 샘플러 선택 모달 */}
      <Modal
        animationType="fade"
        onRequestClose={() => setShowSamplerModal(false)}
        transparent
        visible={showSamplerModal}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.backdrop }]}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={() => setShowSamplerModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>샘플링 방법</Text>
            <ScrollView style={styles.modalList}>
              {SAMPLER_OPTIONS.map(([value, label]) => {
                const isSelected = value === sampler;
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      onSelectSampler(value);
                      setShowSamplerModal(false);
                    }}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: isSelected ? colors.accentText : colors.textSecondary },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowUpscalerModal(false)}
        transparent
        visible={showUpscalerModal}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.backdrop }]}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={() => setShowUpscalerModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>내장 Hires 업스케일러</Text>
            <ScrollView style={styles.modalList}>
              {UPSCALER_OPTIONS.map(([value, label]) => {
                const isSelected = value === upscalerType;
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      onSelectUpscaler(value);
                      setShowUpscalerModal(false);
                    }}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: isSelected ? colors.accentText : colors.textSecondary },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 8,
  },
  headerButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 4,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  rowLabelGroup: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowSubLabel: {
    fontSize: 11,
  },
  rowValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  negativePromptSection: {
    paddingVertical: 12,
    gap: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldCounter: {
    fontSize: 11,
  },
  negativePromptInput: {
    minHeight: 88,
    maxHeight: 132,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
  },
  sliderSection: {
    paddingVertical: 12,
    gap: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scaleValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  sliderHost: {
    height: 32,
    justifyContent: 'center',
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: {
    fontSize: 11,
  },
  seedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seedInput: {
    minWidth: 90,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  diceButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  warningIcon: {
    marginTop: 1,
  },
  warningBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  warningBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
