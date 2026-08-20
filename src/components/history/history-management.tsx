// Official Documentation:
// https://reactnative.dev/docs/flatlist
// https://reactnative.dev/docs/modal
// https://reactnative.dev/docs/pressable
// https://docs.expo.dev/versions/v57.0.0/sdk/sharing/
// https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/

import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Heart, Share2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { getImageFileSize, getStoredImageUri } from '@/lib/image-files';
import { StoredImageMetadata } from '@/lib/image-metadata';

export type HistoryTab = 'all' | 'favorite';
export type HistorySortOrder = 'newest' | 'oldest';

export const HISTORY_TABS: readonly [HistoryTab, string][] = [
  ['all', '전체'],
  ['favorite', '즐겨찾기'],
];

type HistoryCardProps = {
  item: StoredImageMetadata;
  onPress: () => void;
  onToggleFavorite: () => void;
  cardWidth: number;
};

export function HistoryCard({ item, onPress, onToggleFavorite, cardWidth }: HistoryCardProps) {
  const colors = useTheme();
  const imageUri = getStoredImageUri(item.fileName);
  const accessibilityLabel =
    item.metadataStatus === 'complete'
      ? `생성된 이미지: ${item.prompt}`
      : '생성 정보가 없는 저장 이미지';

  return (
    <Pressable
      accessibilityHint="생성 상세정보 모달을 엽니다"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width: cardWidth,
          height: cardWidth * (4 / 3),
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={{ uri: imageUri }}
        style={styles.cardImage}
      />
      <Pressable
        accessibilityHint={item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        accessibilityLabel={item.favorite ? '즐겨찾기됨' : '즐겨찾기 안 됨'}
        accessibilityRole="button"
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        style={({ pressed }) => [
          styles.favoriteBadge,
          { backgroundColor: colors.imageOverlay },
          item.favorite && { backgroundColor: colors.accentSoft },
          pressed && styles.pressed,
        ]}
      >
        <Heart
          color={item.favorite ? colors.error : colors.muted}
          fill={item.favorite ? colors.error : 'transparent'}
          size={14}
        />
      </Pressable>
    </Pressable>
  );
}

type HistoryDetailModalProps = {
  item: StoredImageMetadata;
  onClose: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
};

export function HistoryDetailModal({
  item,
  onClose,
  onDelete,
  onToggleFavorite,
}: HistoryDetailModalProps) {
  const colors = useTheme();
  const [copyState, setCopyState] = useState<{
    field: 'prompt' | 'negativePrompt';
    status: 'success' | 'error';
  } | null>(null);
  const imageUri = getStoredImageUri(item.fileName);
  const fileSize = getImageFileSize(item.fileName);
  const completeMetadata = item.metadataStatus === 'complete' ? item : null;

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          dialogTitle: '생성된 이미지 공유',
          UTI: 'public.png',
        });
      } else {
        await Share.share({
          message: completeMetadata
            ? `[Pocket Canvas]\n프롬프트: ${completeMetadata.prompt}\n모델: ${completeMetadata.model.name}\n스텝: ${completeMetadata.steps}`
            : '[Pocket Canvas] 생성 정보가 없는 저장 이미지',
          url: imageUri,
        });
      }
    } catch (error) {
      console.warn('공유 실패:', error);
    }
  };

  const loraSummary =
    completeMetadata && completeMetadata.loras.length > 0
      ? completeMetadata.loras.map((lora) => `${lora.name} (${lora.weight})`).join(', ')
      : '없음';
  const decoderSummary =
    completeMetadata?.decoder.type === 'taesd' ? completeMetadata.decoder.model.name : '기본 VAE';
  const hiresSummary =
    !completeMetadata || completeMetadata.upscaler.type === 'none'
      ? '사용 안 함'
      : `${completeMetadata.upscaler.type} · ${completeMetadata.upscaler.scale}× · ${completeMetadata.upscaler.steps} steps · denoise ${completeMetadata.upscaler.denoisingStrength}`;

  const getCopyStatus = (field: 'prompt' | 'negativePrompt'): 'idle' | 'success' | 'error' => {
    if (copyState?.field === field) {
      return copyState.status;
    }
    return 'idle';
  };

  const getCopyLabel = (status: 'idle' | 'success' | 'error'): string => {
    switch (status) {
      case 'success':
        return '복사됨';
      case 'error':
        return '복사 실패';
      case 'idle':
      default:
        return '복사';
    }
  };

  const getCopyColor = (status: 'idle' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return colors.accentText;
      case 'error':
        return colors.error;
      case 'idle':
      default:
        return colors.muted;
    }
  };

  const getBoxBorderColor = (status: 'idle' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return colors.accent;
      case 'error':
        return colors.error;
      case 'idle':
      default:
        return colors.border;
    }
  };

  const handleCopy = async (field: 'prompt' | 'negativePrompt', text: string) => {
    if (!text) return;
    try {
      const success = await Clipboard.setStringAsync(text);
      setCopyState({ field, status: success ? 'success' : 'error' });
    } catch (error) {
      console.warn('클립보드 복사 실패:', error);
      setCopyState({ field, status: 'error' });
    }
    setTimeout(() => {
      setCopyState((current) => (current?.field === field ? null : current));
    }, 2000);
  };

  const promptCopyStatus = getCopyStatus('prompt');
  const negativePromptCopyStatus = getCopyStatus('negativePrompt');

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
                <Text
                  accessibilityRole="header"
                  style={[styles.sheetTitle, { color: colors.text }]}
                >
                  상세 정보
                </Text>
                <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose}>
                  <X color={colors.muted} size={20} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.previewContainer,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  resizeMode="contain"
                  source={{ uri: imageUri }}
                  style={styles.detailImage}
                />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onToggleFavorite}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    item.favorite && {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accent,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Heart
                    color={item.favorite ? colors.error : colors.text}
                    fill={item.favorite ? colors.error : 'transparent'}
                    size={16}
                  />
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: item.favorite ? colors.accentText : colors.text },
                    ]}
                  >
                    {item.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleShare}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Share2 color={colors.text} size={16} />
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>공유하기</Text>
                </Pressable>
              </View>

              {completeMetadata ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>프롬프트</Text>
                    <Pressable
                      accessibilityHint="프롬프트를 클립보드에 복사합니다"
                      accessibilityLabel={getCopyLabel(promptCopyStatus)}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => handleCopy('prompt', completeMetadata.prompt)}
                    >
                      <Text
                        style={[
                          styles.copyHint,
                          {
                            color: getCopyColor(promptCopyStatus),
                          },
                        ]}
                      >
                        {getCopyLabel(promptCopyStatus)}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityHint="길게 눌러 프롬프트를 복사합니다"
                    accessibilityLabel={`프롬프트: ${completeMetadata.prompt}`}
                    accessibilityRole="button"
                    delayLongPress={400}
                    onLongPress={() => handleCopy('prompt', completeMetadata.prompt)}
                    style={({ pressed }) => [
                      styles.promptBox,
                      {
                        backgroundColor: colors.surface,
                        borderColor: getBoxBorderColor(promptCopyStatus),
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text selectable style={[styles.promptText, { color: colors.text }]}>
                      {completeMetadata.prompt}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>생성 정보 없음</Text>
                  <View
                    style={[
                      styles.promptBox,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.promptText, { color: colors.muted }]}>
                      이미지는 안전하게 보존됐지만 생성 설정을 기록하지 못했습니다.
                    </Text>
                  </View>
                </View>
              )}

              {completeMetadata && completeMetadata.negativePrompt.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      네거티브 프롬프트
                    </Text>
                    <Pressable
                      accessibilityHint="네거티브 프롬프트를 클립보드에 복사합니다"
                      accessibilityLabel={getCopyLabel(negativePromptCopyStatus)}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => handleCopy('negativePrompt', completeMetadata.negativePrompt)}
                    >
                      <Text
                        style={[
                          styles.copyHint,
                          {
                            color: getCopyColor(negativePromptCopyStatus),
                          },
                        ]}
                      >
                        {getCopyLabel(negativePromptCopyStatus)}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityHint="길게 눌러 네거티브 프롬프트를 복사합니다"
                    accessibilityLabel={`네거티브 프롬프트: ${completeMetadata.negativePrompt}`}
                    accessibilityRole="button"
                    delayLongPress={400}
                    onLongPress={() =>
                      handleCopy('negativePrompt', completeMetadata.negativePrompt)
                    }
                    style={({ pressed }) => [
                      styles.promptBox,
                      {
                        backgroundColor: colors.surface,
                        borderColor: getBoxBorderColor(negativePromptCopyStatus),
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text selectable style={[styles.promptText, { color: colors.text }]}>
                      {completeMetadata.negativePrompt}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>생성 정보</Text>
                {completeMetadata && (
                  <>
                    <DetailRow label="모델" value={completeMetadata.model.name} />
                    <DetailRow label="디코더" value={decoderSummary} />
                    <DetailRow label="LoRA" value={loraSummary} />
                    <DetailRow
                      label="해상도"
                      value={`${completeMetadata.width}×${completeMetadata.height}`}
                    />
                    <DetailRow label="샘플링" value={completeMetadata.samplingPreset} />
                    <DetailRow label="스텝 수" value={`${completeMetadata.steps} steps`} />
                    <DetailRow label="CFG" value={String(completeMetadata.cfgScale)} />
                    <DetailRow label="Seed" value={String(completeMetadata.seed)} />
                    <DetailRow label="Hires" value={hiresSummary} />
                  </>
                )}
                <DetailRow label="생성 일시" value={formatDateTime(item.createdAt)} />
                {fileSize !== null && <DetailRow label="파일 크기" value={formatBytes(fileSize)} />}
                <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.muted }]}>파일명</Text>
                  <Text
                    numberOfLines={1}
                    selectable
                    style={[styles.filenameText, { color: colors.text }]}
                  >
                    {item.fileName}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onDelete}
                style={[styles.deleteButton, { borderColor: colors.error }]}
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

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}. ${month}. ${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  favoriteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  modal: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  previewContainer: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    gap: 8,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  copyHint: {
    fontSize: 12,
  },
  promptBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingVertical: 11,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 16,
    textAlign: 'right',
  },
  filenameText: {
    flex: 1,
    fontSize: 12,
    marginLeft: 16,
    textAlign: 'right',
  },
  deleteButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 20,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
