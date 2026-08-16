import { useState } from 'react';
import {
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

import { Colors } from '@/constants/theme';

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
  color: string;
};

export const MODEL_KINDS: readonly [ModelKind, string][] = [
  ['model', '모델'],
  ['lora', 'LoRA'],
  ['unknown', '미분류'],
];

export const modelKindLabel = (kind: ModelKind) =>
  MODEL_KINDS.find(([value]) => value === kind)?.[1];

type ModelCardProps = {
  item: ManagedModel;
  onPress: () => void;
};

export function ModelCard({ item, onPress }: ModelCardProps) {
  return (
    <Pressable
      accessibilityHint="상세정보와 관리 메뉴를 엽니다"
      accessibilityLabel={item.name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.thumbnail, { backgroundColor: item.color }]}>
        <Text style={styles.thumbnailText}>
          {item.kind === 'model' ? 'SD' : item.kind === 'lora' ? 'L' : '?'}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.itemName}>
          {item.name}
        </Text>
        <Text style={styles.metadata}>
          {item.format} · {item.size}
        </Text>
        <Text numberOfLines={2} style={styles.description}>
          {item.description}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

type ModelDetailModalProps = {
  item: ManagedModel;
  onClose: () => void;
  onDelete: () => void;
  onDescriptionChange: (description: string) => void;
  onKindChange: (kind: ModelKind) => void;
  onRename: (name: string) => void;
};

export function ModelDetailModal({
  item,
  onClose,
  onDelete,
  onDescriptionChange,
  onKindChange,
  onRename,
}: ModelDetailModalProps) {
  const [name, setName] = useState(item.name);
  const [choosingKind, setChoosingKind] = useState(false);
  const trimmedName = name.trim();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modal}
      >
        <Pressable onPress={onClose} style={styles.backdrop}>
          <Pressable accessibilityViewIsModal onPress={() => {}} style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                <TextInput
                  accessibilityHint="터치하여 이름을 변경합니다"
                  accessibilityLabel="표시 이름"
                  maxLength={80}
                  onChangeText={setName}
                  selectTextOnFocus
                  style={styles.sheetNameInput}
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
                  style={[styles.renameButton, !trimmedName && styles.disabled]}
                >
                  <Text style={styles.renameButtonText}>변경</Text>
                </Pressable>
                <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>

              <TextInput
                accessibilityLabel="설명"
                maxLength={300}
                multiline
                onChangeText={onDescriptionChange}
                placeholder="이 모델에 대한 설명을 입력하세요"
                placeholderTextColor={Colors.dark.placeholder}
                style={styles.descriptionInput}
                textAlignVertical="top"
                value={item.description}
              />
              <View style={[styles.detailRow, styles.classificationRow]}>
                <Text style={styles.detailLabel}>분류</Text>
                <Pressable
                  accessibilityHint="터치하여 분류를 변경합니다"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: choosingKind }}
                  onPress={() => setChoosingKind((current) => !current)}
                  style={({ pressed }) => [styles.classificationButton, pressed && styles.pressed]}
                >
                  <Text style={styles.classificationValue}>{modelKindLabel(item.kind)}</Text>
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
                        style={[styles.kindOption, checked && styles.selectedKindOption]}
                      >
                        <Text style={[styles.kindText, checked && styles.selectedKindText]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {item.kind !== item.detectedKind && (
                <Text style={styles.overrideNotice}>
                  자동 판별은 {modelKindLabel(item.detectedKind)}이며 사용자가 분류를 변경했습니다.
                </Text>
              )}
              <DetailRow label="파일 형식" value={item.format} />
              <DetailRow label="파일 크기" value={item.size} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>원본 파일명</Text>
                <Text selectable style={styles.filename}>
                  {item.filename}
                </Text>
              </View>
              <Pressable onPress={onDelete} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>삭제</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    borderColor: Colors.dark.border,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    padding: 10,
  },
  thumbnail: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  thumbnailText: { color: Colors.dark.onAccent, fontSize: 18, fontWeight: '800' },
  cardBody: { flex: 1 },
  itemName: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' },
  metadata: { color: Colors.dark.muted, fontSize: 12, marginTop: 5 },
  description: { color: Colors.dark.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  chevron: { color: Colors.dark.muted, fontSize: 28, marginHorizontal: 4 },
  pressed: { opacity: 0.7 },
  modal: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.dark.backdrop },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: Colors.dark.surfaceRaised,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetNameInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.accentSoft,
    marginRight: 14,
  },
  renameButtonText: { color: Colors.dark.accentText, fontSize: 13, fontWeight: '700' },
  close: { color: Colors.dark.muted, fontSize: 20, padding: 4 },
  descriptionInput: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    color: Colors.dark.text,
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
    borderTopColor: Colors.dark.border,
    paddingVertical: 12,
  },
  detailLabel: { color: Colors.dark.muted, fontSize: 13 },
  detailValue: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' },
  classificationButton: {
    backgroundColor: Colors.dark.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  classificationValue: { color: Colors.dark.accentText, fontSize: 13, fontWeight: '700' },
  kindOptions: { flexDirection: 'row', gap: 8 },
  kindOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 9,
  },
  selectedKindOption: { borderColor: Colors.dark.accent, backgroundColor: Colors.dark.accentSoft },
  kindText: { color: Colors.dark.muted, fontSize: 13, fontWeight: '600' },
  selectedKindText: { color: Colors.dark.accentText },
  overrideNotice: {
    color: Colors.dark.accentText,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: Colors.dark.accentSoft,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  filename: { flex: 1, color: Colors.dark.text, fontSize: 12, marginLeft: 16, textAlign: 'right' },
  deleteButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.error,
    borderRadius: 10,
    marginTop: 24,
  },
  deleteButtonText: { color: Colors.dark.error, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
