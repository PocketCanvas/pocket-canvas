// Official Documentation:
// https://reactnative.dev/docs/flatlist
// https://reactnative.dev/docs/usewindowdimensions
// https://docs.expo.dev/router/reference/hooks/#usefocuseffect

import { ArrowUpDown, EllipsisVertical, Search, Sparkles, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  HISTORY_TABS,
  HistoryCard,
  HistoryDetailModal,
  HistorySortOrder,
  HistoryTab,
} from '@/components/history/history-management';
import { useTheme } from '@/hooks/use-theme';
import { deleteStoredImage, loadStoredImages, toggleFavoriteImage } from '@/lib/image-files';
import { StoredImageMetadata } from '@/lib/image-metadata';

export default function HistoryScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<StoredImageMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>('newest');

  const refreshImages = useCallback(async () => {
    try {
      const loaded = await loadStoredImages();
      setItems(loaded);
    } catch (error) {
      Alert.alert(
        '히스토리를 불러오지 못했습니다.',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshImages();
    }, [refreshImages]),
  );

  const handleToggleFavorite = async (id: string) => {
    // Optimistic update
    setItems((current) =>
      current.map((img) => (img.id === id ? { ...img, favorite: !img.favorite } : img)),
    );
    try {
      const updated = await toggleFavoriteImage(id);
      setItems(updated);
    } catch (error) {
      Alert.alert(
        '즐겨찾기를 변경하지 못했습니다.',
        error instanceof Error ? error.message : String(error),
      );
      refreshImages();
    }
  };

  const handleDelete = (item: StoredImageMetadata) => {
    Alert.alert('이미지를 삭제할까요?', '기기에서 영구히 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await deleteStoredImage(item.id);
            setItems(updated);
            setSelectedId(null);
          } catch (error) {
            Alert.alert(
              '이미지를 삭제하지 못했습니다.',
              error instanceof Error ? error.message : String(error),
            );
          }
        },
      },
    ]);
  };

  const handleMoreMenu = () => {
    Alert.alert('히스토리 옵션', `총 ${items.length}개의 생성 이미지가 저장되어 있습니다.`, [
      { text: '닫기', style: 'cancel' },
      {
        text: '목록 새로고침',
        onPress: () => {
          setIsLoading(true);
          refreshImages();
        },
      },
    ]);
  };

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = items;

    // Tab filter
    if (activeTab === 'favorite') {
      result = result.filter((item) => item.favorite);
    }

    // Search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (item) =>
          item.fileName.toLowerCase().includes(query) ||
          (item.metadataStatus === 'complete' &&
            (item.prompt.toLowerCase().includes(query) ||
              item.model.name.toLowerCase().includes(query) ||
              item.loras.some((lora) => lora.name.toLowerCase().includes(query)))),
      );
    }

    // Sort order
    if (sortOrder === 'oldest') {
      result = [...result].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return result;
  }, [items, activeTab, searchQuery, sortOrder]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const favoriteCount = items.filter((i) => i.favorite).length;
    return {
      all: items.length,
      favorite: favoriteCount,
    };
  }, [items]);

  // 3-column grid calculation
  const padding = 20;
  const gap = 8;
  const numColumns = 3;
  const cardWidth = Math.floor((width - padding * 2 - gap * (numColumns - 1)) / numColumns);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            히스토리
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityHint="프롬프트 검색창을 열거나 닫습니다"
            accessibilityLabel="검색"
            accessibilityRole="button"
            onPress={() => {
              setShowSearch((prev) => !prev);
              if (showSearch) setSearchQuery('');
            }}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              showSearch && {
                backgroundColor: colors.accentSoft,
                borderColor: colors.accent,
              },
              pressed && styles.pressed,
            ]}
          >
            <Search color={showSearch ? colors.accentText : colors.text} size={18} />
          </Pressable>

          <Pressable
            accessibilityHint={`정렬 순서 변경: 현재 ${sortOrder === 'newest' ? '최신순' : '오래된순'}`}
            accessibilityLabel="정렬 순서 변경"
            accessibilityRole="button"
            onPress={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <ArrowUpDown color={colors.text} size={18} />
          </Pressable>

          <Pressable
            accessibilityHint="추가 옵션 메뉴를 엽니다"
            accessibilityLabel="더보기 메뉴"
            accessibilityRole="button"
            onPress={handleMoreMenu}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <EllipsisVertical color={colors.text} size={18} />
          </Pressable>
        </View>
      </View>

      {showSearch && (
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            accessibilityLabel="히스토리 검색"
            autoFocus
            onChangeText={setSearchQuery}
            placeholder="프롬프트 또는 모델명 검색..."
            placeholderTextColor={colors.placeholder}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
          />
          {Boolean(searchQuery) && (
            <Pressable
              accessibilityLabel="검색어 지우기"
              accessibilityRole="button"
              onPress={() => setSearchQuery('')}
              style={styles.clearSearch}
            >
              <X color={colors.muted} size={16} />
            </Pressable>
          )}
        </View>
      )}

      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {HISTORY_TABS.map(([value, label]) => {
          const selectedTab = activeTab === value;
          const count = tabCounts[value];
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab }}
              key={value}
              onPress={() => setActiveTab(value)}
              style={[
                styles.tab,
                selectedTab && [styles.selectedTab, { borderBottomColor: colors.accent }],
              ]}
            >
              <Text
                style={[styles.tabText, { color: selectedTab ? colors.accentText : colors.muted }]}
              >
                {label} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.sparkle, { backgroundColor: colors.accentSoft }]}>
            <Sparkles color={colors.accentIcon} size={22} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery
              ? '검색 결과가 없습니다'
              : activeTab === 'favorite'
                ? '즐겨찾기한 이미지가 없습니다'
                : '저장된 이미지가 없습니다'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            {searchQuery
              ? '다른 검색어로 다시 시도해 보세요.'
              : activeTab === 'favorite'
                ? '마음에 드는 이미지의 하트 아이콘을 눌러 추가해 보세요.'
                : '생성 탭에서 새로운 이미지를 만들어 보세요.'}
          </Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={{ gap }}
          contentContainerStyle={[styles.gridContent, { padding }]}
          data={filteredItems}
          initialNumToRender={12}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={12}
          numColumns={numColumns}
          renderItem={({ item }) => (
            <HistoryCard
              cardWidth={cardWidth}
              item={item}
              onPress={() => setSelectedId(item.id)}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          windowSize={5}
        />
      )}

      {selectedItem && (
        <HistoryDetailModal
          item={selectedItem}
          key={selectedItem.id}
          onClose={() => setSelectedId(null)}
          onDelete={() => handleDelete(selectedItem)}
          onToggleFavorite={() => handleToggleFavorite(selectedItem.id)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  clearSearch: {
    padding: 6,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContent: {
    paddingBottom: 130,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  sparkle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
});
