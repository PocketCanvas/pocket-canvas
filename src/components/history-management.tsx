// Official Documentation:
// https://reactnative.dev/docs/flatlist
// https://reactnative.dev/docs/modal
// https://reactnative.dev/docs/pressable
// https://docs.expo.dev/versions/v57.0.0/sdk/sharing/

import { Heart, Share2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import * as Sharing from 'expo-sharing';
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

import { Colors } from '@/constants/theme';
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
  const imageUri = getStoredImageUri(item.fileName);

  return (
    <Pressable
      accessibilityHint="생성 상세정보 모달을 엽니다"
      accessibilityLabel={`생성된 이미지: ${item.prompt}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, height: cardWidth * (4 / 3) },
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
          item.favorite && styles.favoriteBadgeActive,
          pressed && styles.pressed,
        ]}
      >
        <Heart
          color={item.favorite ? Colors.dark.error : Colors.dark.muted}
          fill={item.favorite ? Colors.dark.error : 'transparent'}
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
  const [copied, setCopied] = useState(false);
  const imageUri = getStoredImageUri(item.fileName);
  const fileSize = getImageFileSize(item.fileName);

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
          message: `[Pocket Canvas]\n프롬프트: ${item.prompt}\n모델: ${item.model.name}\n스텝: ${item.steps}`,
          url: imageUri,
        });
      }
    } catch (error) {
      console.warn('공유 실패:', error);
    }
  };

  const loraSummary =
    item.loras.length > 0 ? item.loras.map((l) => `${l.name} (${l.weight})`).join(', ') : '없음';

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modal}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityLabel="배경 터치하여 닫기"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheet}>
            <ScrollView
              bounces
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View style={styles.sheetHeader}>
                <Text accessibilityRole="header" style={styles.sheetTitle}>
                  생성 상세 정보
                </Text>
                <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose}>
                  <X color={Colors.dark.muted} size={20} />
                </Pressable>
              </View>

              <View style={styles.previewContainer}>
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
                    item.favorite && styles.actionButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Heart
                    color={item.favorite ? Colors.dark.error : Colors.dark.text}
                    fill={item.favorite ? Colors.dark.error : 'transparent'}
                    size={16}
                  />
                  <Text
                    style={[
                      styles.actionButtonText,
                      item.favorite && styles.actionButtonTextActive,
                    ]}
                  >
                    {item.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleShare}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                >
                  <Share2 color={Colors.dark.text} size={16} />
                  <Text style={styles.actionButtonText}>공유하기</Text>
                </Pressable>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>프롬프트</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Text style={styles.copyHint}>{copied ? '복사됨!' : '길게 눌러 복사'}</Text>
                  </Pressable>
                </View>
                <View style={styles.promptBox}>
                  <Text selectable style={styles.promptText}>
                    {item.prompt}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>생성 정보</Text>
                <DetailRow label="모델" value={item.model.name} />
                <DetailRow label="LoRA" value={loraSummary} />
                <DetailRow label="스텝 수" value={`${item.steps} steps`} />
                <DetailRow label="생성 일시" value={formatDateTime(item.createdAt)} />
                {fileSize !== null && <DetailRow label="파일 크기" value={formatBytes(fileSize)} />}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>파일명</Text>
                  <Text numberOfLines={1} selectable style={styles.filenameText}>
                    {item.fileName}
                  </Text>
                </View>
              </View>

              <Pressable onPress={onDelete} style={styles.deleteButton}>
                <Trash2 color={Colors.dark.error} size={16} />
                <Text style={styles.deleteButtonText}>삭제</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
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
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBadgeActive: {
    backgroundColor: Colors.dark.accentSoft,
  },
  favoriteIcon: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
  favoriteIconActive: {
    color: Colors.dark.accentText,
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
    backgroundColor: Colors.dark.backdrop,
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: Colors.dark.surfaceRaised,
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
    color: Colors.dark.text,
    fontSize: 19,
    fontWeight: '700',
  },
  close: {
    color: Colors.dark.muted,
    fontSize: 20,
    padding: 4,
  },
  previewContainer: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
    borderColor: Colors.dark.border,
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
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
  },
  actionButtonActive: {
    backgroundColor: Colors.dark.accentSoft,
    borderColor: Colors.dark.accent,
  },
  actionButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextActive: {
    color: Colors.dark.accentText,
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
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  copyHint: {
    color: Colors.dark.muted,
    fontSize: 12,
  },
  promptBox: {
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    padding: 12,
  },
  promptText: {
    color: Colors.dark.text,
    fontSize: 14,
    lineHeight: 20,
  },
  metadataSection: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingVertical: 11,
  },
  detailLabel: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  detailValue: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filenameText: {
    flex: 1,
    color: Colors.dark.text,
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
    borderColor: Colors.dark.error,
    borderRadius: 10,
    marginTop: 20,
  },
  deleteButtonText: {
    color: Colors.dark.error,
    fontSize: 14,
    fontWeight: '700',
  },
});
