import { Box, ChevronRight, CircleHelp, Layers, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import {
  quantizationProgressPercent,
  QUANTIZATION_OPTIONS,
  type QuantizationTask,
  type QuantizationType,
} from '@/lib/model-quantization';

export type ModelKind = 'model' | 'lora' | 'unknown';

export type ManagedModel = {
  id: string;
  name: string;
  kind: ModelKind;
  detectedKind: ModelKind;
  format: string;
  size: string;
  filename: string;
  description: string;
  quantization?: QuantizationType;
  color: string;
};

export const MODEL_KINDS: readonly [ModelKind, string][] = [
  ['model', '모델'],
  ['lora', 'LoRA'],
  ['unknown', '기타'],
];

export const modelKindLabel = (kind: ModelKind) =>
  MODEL_KINDS.find(([value]) => value === kind)?.[1];

type ModelCardProps = {
  item: ManagedModel;
  onPress: () => void;
};

export function ModelCard({ item, onPress }: ModelCardProps) {
  const colors = useTheme();
  const Icon = item.kind === 'model' ? Box : item.kind === 'lora' ? Layers : CircleHelp;

  return (
    <Pressable
      accessibilityHint="상세정보와 관리 메뉴를 엽니다"
      accessibilityLabel={item.name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.thumbnail, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accentIcon} size={28} />
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.metadata, { color: colors.muted }]}>
          {item.format} · {item.size}
        </Text>
        <Text numberOfLines={2} style={[styles.description, { color: colors.textSecondary }]}>
          {item.description || '설명이 없습니다.'}
        </Text>
      </View>
      <ChevronRight color={colors.muted} size={22} style={styles.chevron} />
    </Pressable>
  );
}

export function QuantizationProgressBanner({ task }: { task: QuantizationTask }) {
  const colors = useTheme();
  const percent = quantizationProgressPercent(task);
  const detail =
    task.totalTensors > 0
      ? `${task.completedTensors} / ${task.totalTensors} tensors`
      : '변환 준비 중';

  return (
    <View
      accessibilityLabel={`${task.modelName} ${task.type.toUpperCase()} 양자화`}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent, text: detail }}
      style={[
        styles.progressBanner,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <ActivityIndicator color={colors.accent} size="small" />
      <View style={styles.progressBody}>
        <View style={styles.progressHeader}>
          <Text numberOfLines={1} style={[styles.progressModelName, { color: colors.text }]}>
            {task.modelName}
          </Text>
          <Text style={[styles.progressType, { color: colors.accentText }]}>
            {task.type.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.track }]}>
          <View
            style={[styles.progressFill, { backgroundColor: colors.accent, width: `${percent}%` }]}
          />
        </View>
        <View style={styles.progressFooter}>
          <Text style={[styles.progressDetail, { color: colors.muted }]}>{detail}</Text>
          <Text style={[styles.progressPercent, { color: colors.text }]}>{percent}%</Text>
        </View>
      </View>
    </View>
  );
}

type ModelDetailModalProps = {
  item: ManagedModel;
  onClose: () => void;
  onDelete: () => void;
  onDescriptionChange: (description: string) => void;
  onDescriptionCommit: () => void;
  onKindChange: (kind: ModelKind) => void;
  onQuantize: (type: QuantizationType) => void;
  onRename: (name: string) => void;
  isQuantizing: boolean;
};

export function ModelDetailModal({
  item,
  isQuantizing,
  onClose,
  onDelete,
  onDescriptionChange,
  onDescriptionCommit,
  onKindChange,
  onQuantize,
  onRename,
}: ModelDetailModalProps) {
  const colors = useTheme();
  const [name, setName] = useState(item.name);
  const [choosingKind, setChoosingKind] = useState(false);
  const [quantizationType, setQuantizationType] = useState<QuantizationType>('q4_K');
  const trimmedName = name.trim();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modal}
      >
        <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
          <Pressable
            accessibilityLabel="배경 터치하여 닫기"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheet, { backgroundColor: colors.surfaceRaised }]}>
            <ScrollView
              bounces
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View style={styles.sheetHeader}>
                <TextInput
                  accessibilityHint="터치하여 이름을 변경합니다"
                  accessibilityLabel="표시 이름"
                  maxLength={80}
                  onChangeText={setName}
                  selectTextOnFocus
                  style={[
                    styles.sheetNameInput,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      color: colors.text,
                    },
                  ]}
                  value={name}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !trimmedName }}
                  disabled={!trimmedName}
                  onPress={() => {
                    onRename(trimmedName);
                    setName(trimmedName);
                  }}
                  style={[
                    styles.renameButton,
                    { backgroundColor: colors.accentSoft },
                    !trimmedName && styles.disabled,
                  ]}
                >
                  <Text style={[styles.renameButtonText, { color: colors.accentText }]}>변경</Text>
                </Pressable>
                <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose}>
                  <Text style={[styles.close, { color: colors.muted }]}>✕</Text>
                </Pressable>
              </View>

              <TextInput
                accessibilityLabel="설명"
                maxLength={300}
                multiline
                onChangeText={onDescriptionChange}
                onEndEditing={onDescriptionCommit}
                placeholder="이 모델에 대한 설명을 입력하세요"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.descriptionInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  },
                ]}
                textAlignVertical="top"
                value={item.description}
              />
              <View
                style={[
                  styles.detailRow,
                  styles.classificationRow,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text style={[styles.detailLabel, { color: colors.muted }]}>분류</Text>
                <Pressable
                  accessibilityHint="터치하여 분류를 변경합니다"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: choosingKind }}
                  onPress={() => setChoosingKind((current) => !current)}
                  style={({ pressed }) => [
                    styles.classificationButton,
                    { backgroundColor: colors.accentSoft },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.classificationValue, { color: colors.accentText }]}>
                    {modelKindLabel(item.kind)}
                  </Text>
                </Pressable>
              </View>
              {choosingKind && (
                <View style={styles.kindOptions}>
                  {MODEL_KINDS.map(([value, label]) => {
                    const checked = item.kind === value;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked }}
                        key={value}
                        onPress={() => {
                          onKindChange(value);
                          setChoosingKind(false);
                        }}
                        style={[
                          styles.kindOption,
                          { borderColor: checked ? colors.accent : colors.border },
                          checked && { backgroundColor: colors.accentSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kindText,
                            { color: checked ? colors.accentText : colors.muted },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {item.kind !== item.detectedKind && (
                <Text
                  style={[
                    styles.overrideNotice,
                    {
                      color: colors.accentText,
                      backgroundColor: colors.accentSoft,
                    },
                  ]}
                >
                  자동 판별은 {modelKindLabel(item.detectedKind)}이며 사용자가 분류를 변경했습니다.
                </Text>
              )}
              <DetailRow label="파일 형식" value={item.format} />
              {item.quantization && (
                <DetailRow label="양자화" value={item.quantization.toUpperCase()} />
              )}
              <DetailRow label="파일 크기" value={item.size} />
              <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>원본 파일명</Text>
                <Text selectable style={[styles.filename, { color: colors.text }]}>
                  {item.filename}
                </Text>
              </View>
              {item.kind === 'model' && (
                <View style={[styles.quantizationSection, { borderTopColor: colors.border }]}>
                  <Text style={[styles.quantizationTitle, { color: colors.text }]}>
                    양자화 모델 생성
                  </Text>
                  <Text style={[styles.quantizationDescription, { color: colors.muted }]}>
                    원본은 보존하고 새로운 GGUF 파일을 만듭니다. 숫자가 낮을수록 파일은 작아지지만
                    품질 손실이 커질 수 있습니다.
                  </Text>
                  <View style={styles.quantizationOptions}>
                    {QUANTIZATION_OPTIONS.map((option) => {
                      const checked = quantizationType === option.value;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked, disabled: isQuantizing }}
                          disabled={isQuantizing}
                          key={option.value}
                          onPress={() => setQuantizationType(option.value)}
                          style={[
                            styles.quantizationOption,
                            { borderColor: checked ? colors.accent : colors.border },
                            checked && { backgroundColor: colors.accentSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.quantizationOptionLabel,
                              { color: checked ? colors.accentText : colors.text },
                            ]}
                          >
                            {option.label}
                          </Text>
                          <Text
                            style={[styles.quantizationOptionDescription, { color: colors.muted }]}
                          >
                            {option.description}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isQuantizing }}
                    disabled={isQuantizing}
                    onPress={() => onQuantize(quantizationType)}
                    style={[
                      styles.quantizeButton,
                      { backgroundColor: colors.accent },
                      isQuantizing && styles.disabled,
                    ]}
                  >
                    {isQuantizing ? (
                      <>
                        <ActivityIndicator color={colors.onAccent} size="small" />
                        <Text style={[styles.quantizeButtonText, { color: colors.onAccent }]}>
                          양자화 중…
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.quantizeButtonText, { color: colors.onAccent }]}>
                        {quantizationType.toUpperCase()} 생성
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
              <Pressable
                disabled={isQuantizing}
                onPress={onDelete}
                style={[
                  styles.deleteButton,
                  { borderColor: colors.error },
                  isQuantizing && styles.disabled,
                ]}
              >
                <Trash2 color={colors.error} size={16} />
                <Text style={[styles.deleteButtonText, { color: colors.error }]}>삭제</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useTheme();

  return (
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  thumbnail: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  cardBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700' },
  metadata: { fontSize: 12, marginTop: 5 },
  description: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  chevron: { marginHorizontal: 4 },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  progressBody: { flex: 1, gap: 8 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressModelName: { flex: 1, fontSize: 14, fontWeight: '600' },
  progressType: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 3 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progressDetail: { fontSize: 12 },
  progressPercent: { fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  modal: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  sheetScrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetNameInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 19,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  renameButton: {
    minWidth: 52,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginRight: 14,
  },
  renameButtonText: { fontSize: 13, fontWeight: '700' },
  close: { fontSize: 20, padding: 4 },
  descriptionInput: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 19,
    padding: 12,
  },
  classificationRow: { marginTop: 16 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '600' },
  classificationButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  classificationValue: { fontSize: 13, fontWeight: '700' },
  kindOptions: { flexDirection: 'row', gap: 8 },
  kindOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 9,
  },
  kindText: { fontSize: 13, fontWeight: '600' },
  overrideNotice: {
    fontSize: 12,
    lineHeight: 18,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  filename: { flex: 1, fontSize: 12, marginLeft: 16, textAlign: 'right' },
  quantizationSection: { borderTopWidth: 1, paddingTop: 18, marginTop: 4 },
  quantizationTitle: { fontSize: 15, fontWeight: '700' },
  quantizationDescription: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  quantizationOptions: { gap: 8, marginTop: 14 },
  quantizationOption: { borderWidth: 1, borderRadius: 10, padding: 12 },
  quantizationOptionLabel: { fontSize: 13, fontWeight: '700' },
  quantizationOptionDescription: { fontSize: 11, marginTop: 3 },
  quantizeButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  quantizeButtonText: { fontSize: 14, fontWeight: '700' },
  deleteButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 24,
  },
  deleteButtonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
