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

import { CompactSlider } from '@/components/compact-slider';
import { Colors } from '@/constants/theme';
import { StoredModel } from '@/lib/model-files';

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

export const SAMPLER_OPTIONS: string[] = [
  'Euler a',
  'Euler',
  'DPM++ 2M',
  'DPM++ 2M Karras',
  'DPM++ SDE Karras',
  'LCM',
  'DDIM',
];

type AdvancedGenerationOptionsProps = {
  taesd: StoredModel | null;
  onOpenTaesdPicker: () => void;
  imageSize: ImageSizeOption;
  onSelectImageSize: (size: ImageSizeOption) => void;
  upscaler: StoredModel | null;
  onOpenUpscalerPicker: () => void;
  sampler: string;
  onSelectSampler: (sampler: string) => void;
  cfgScale: number;
  onChangeCfgScale: (value: number) => void;
  seed: number;
  onChangeSeed: (seed: number) => void;
  isFixedSeed: boolean;
  onToggleFixedSeed: (enabled: boolean) => void;
};

export function AdvancedGenerationOptions({
  taesd,
  onOpenTaesdPicker,
  imageSize,
  onSelectImageSize,
  upscaler,
  onOpenUpscalerPicker,
  sampler,
  onSelectSampler,
  cfgScale,
  onChangeCfgScale,
  seed,
  onChangeSeed,
  isFixedSeed,
  onToggleFixedSeed,
}: AdvancedGenerationOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [showSamplerModal, setShowSamplerModal] = useState(false);

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
        <Text style={styles.headerTitle}>고급 옵션</Text>
        {isExpanded ? (
          <ChevronDown color={Colors.dark.muted} size={20} />
        ) : (
          <ChevronRight color={Colors.dark.muted} size={20} />
        )}
      </Pressable>

      {isExpanded && (
        <View style={styles.card}>
          {/* 1. 경량 디코더 (TAESD / VAE) */}
          <Pressable
            accessibilityHint="TAESD 가중치 목록을 엽니다"
            accessibilityRole="button"
            onPress={onOpenTaesdPicker}
            style={({ pressed }) => [styles.row, styles.borderBottom, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel}>경량 디코더 (TAESD)</Text>
            <View style={styles.rowValueGroup}>
              <Text numberOfLines={1} style={styles.rowValue}>
                {taesd?.alias ?? '기본 VAE'}
              </Text>
              <ChevronRight color={Colors.dark.muted} size={18} />
            </View>
          </Pressable>

          {/* 2. 기본 이미지 사이즈 */}
          <View style={styles.borderBottom}>
            <Pressable
              accessibilityHint="이미지 해상도를 선택합니다"
              accessibilityRole="button"
              onPress={() => setShowSizeModal(true)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowLabel}>기본 이미지 사이즈</Text>
              <View style={styles.rowValueGroup}>
                <Text style={[styles.rowValue, Boolean(imageSize.warning) && styles.warningText]}>
                  {imageSize.label}
                </Text>
                <ChevronRight color={Colors.dark.muted} size={18} />
              </View>
            </Pressable>
            {Boolean(imageSize.warning) && (
              <View style={styles.warningBox}>
                <TriangleAlert color="#FBBF24" size={15} style={styles.warningIcon} />
                <Text style={styles.warningBoxText}>{imageSize.warning}</Text>
              </View>
            )}
          </View>

          {/* 3. 업스케일러 (Upscaler) */}
          <Pressable
            accessibilityHint="업스케일러 모델 목록을 엽니다"
            accessibilityRole="button"
            onPress={onOpenUpscalerPicker}
            style={({ pressed }) => [styles.row, styles.borderBottom, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel}>업스케일러 (Upscaler)</Text>
            <View style={styles.rowValueGroup}>
              <Text numberOfLines={1} style={styles.rowValue}>
                {upscaler?.alias ?? '사용 안 함'}
              </Text>
              <ChevronRight color={Colors.dark.muted} size={18} />
            </View>
          </Pressable>

          {/* 4. 샘플링 방법 */}
          <Pressable
            accessibilityHint="샘플러 알고리즘을 선택합니다"
            accessibilityRole="button"
            onPress={() => setShowSamplerModal(true)}
            style={({ pressed }) => [styles.row, styles.borderBottom, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel}>샘플링 방법</Text>
            <View style={styles.rowValueGroup}>
              <Text style={styles.rowValue}>{sampler}</Text>
              <ChevronRight color={Colors.dark.muted} size={18} />
            </View>
          </Pressable>

          {/* 4. CFG Scale 슬라이더 */}
          <View style={[styles.sliderSection, styles.borderBottom]}>
            <View style={styles.sliderHeader}>
              <Text style={styles.rowLabel}>CFG Scale</Text>
              <Text style={styles.scaleValue}>{cfgScale.toFixed(1)}</Text>
            </View>
            <Host colorScheme="dark" seedColor={Colors.dark.accent} style={styles.sliderHost}>
              <CompactSlider
                max={20}
                min={1}
                onValueChange={(val) => onChangeCfgScale(Math.round(val * 2) / 2)}
                steps={38}
                value={cfgScale}
              />
            </Host>
            <View style={styles.sliderRange}>
              <Text style={styles.rangeText}>1.0</Text>
              <Text style={styles.rangeText}>20.0</Text>
            </View>
          </View>

          {/* 5. 시드 */}
          <View style={[styles.row, styles.borderBottom]}>
            <View style={styles.seedRow}>
              <Text style={styles.rowLabel}>시드</Text>
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
                placeholderTextColor={Colors.dark.placeholder}
                style={styles.seedInput}
                value={isFixedSeed && seed !== -1 ? String(seed) : '-1'}
              />
            </View>
            <Pressable
              accessibilityHint="새로운 무작위 시드를 생성하고 고정합니다"
              accessibilityLabel="랜덤 시드 주사위"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleRandomizeSeed}
              style={({ pressed }) => [styles.diceButton, pressed && styles.pressed]}
            >
              <Dices color={Colors.dark.accentText} size={20} />
            </Pressable>
          </View>

          {/* 6. 고정 시드 토글 */}
          <View style={styles.row}>
            <View style={styles.rowLabelGroup}>
              <Text style={styles.rowLabel}>고정 시드</Text>
              <Text style={styles.rowSubLabel}>활성화 시 동일한 시드로 재현 가능</Text>
            </View>
            <Switch
              accessibilityLabel="고정 시드 활성화"
              onValueChange={handleToggleFixedSeed}
              thumbColor="#FFFFFF"
              trackColor={{ false: Colors.dark.border, true: Colors.dark.accent }}
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
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={() => setShowSizeModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>기본 이미지 사이즈</Text>
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
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  >
                    <View style={styles.modalOptionRow}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          isSelected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {Boolean(opt.warning) && (
                        <View style={styles.warningBadge}>
                          <Text style={styles.warningBadgeText}>주의</Text>
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
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={() => setShowSamplerModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>샘플링 방법</Text>
            <ScrollView style={styles.modalList}>
              {SAMPLER_OPTIONS.map((opt) => {
                const isSelected = opt === sampler;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      onSelectSampler(opt);
                      setShowSamplerModal(false);
                    }}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  >
                    <Text
                      style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}
                    >
                      {opt}
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
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
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
    borderBottomColor: Colors.dark.border,
  },
  rowLabelGroup: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '500',
  },
  rowSubLabel: {
    color: Colors.dark.muted,
    fontSize: 11,
  },
  rowValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    color: Colors.dark.muted,
    fontSize: 13,
    fontWeight: '500',
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
    color: Colors.dark.text,
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
    color: Colors.dark.muted,
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
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: Colors.dark.surfaceRaised,
    borderColor: Colors.dark.border,
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
    backgroundColor: Colors.dark.accentSoft,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.backdrop,
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: 380,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceRaised,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    color: Colors.dark.text,
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
  modalOptionSelected: {
    backgroundColor: Colors.dark.accentSoft,
  },
  modalOptionText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  modalOptionTextSelected: {
    color: Colors.dark.accentText,
    fontWeight: '700',
  },
  warningText: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
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
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 17,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  warningBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
