import { Image, Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/common/app-icon';

import { useTheme } from '@/hooks/use-theme';
import { getStoredImageUri } from '@/lib/image-files';
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
      accessibilityHint="전체 화면 이미지 뷰어를 엽니다"
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
        <AppIcon
          color={item.favorite ? 'error' : 'muted'}
          fill={item.favorite ? colors.error : 'transparent'}
          name="Heart"
          size="micro"
        />
      </Pressable>
    </Pressable>
  );
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
});
