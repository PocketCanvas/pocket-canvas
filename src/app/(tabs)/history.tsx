// Official Documentation:
// https://reactnative.dev/docs/flatlist
// https://reactnative.dev/docs/usewindowdimensions

import { useState } from 'react';
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

import { AppIcon } from '@/components/common/app-icon';
import { ScreenHeader } from '@/components/common/screen-header';

import { HistoryImageViewer } from '@/components/history/history-image-viewer';
import { HISTORY_TABS, HistoryCard } from '@/components/history/history-management';
import { useHistoryManagement } from '@/hooks/use-history-management';
import { useTheme } from '@/hooks/use-theme';
import { getImageFileSize, getStoredImageUri } from '@/storage/image-storage';
import type { HistorySortOrder, HistoryTab } from '@/features/history/query';

export default function HistoryScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>('newest');
  const {
    closeViewer,
    deleteImage,
    filteredItems,
    isLoading,
    refreshImages,
    selectedId,
    selectImage,
    tabCounts,
    toggleFavorite,
  } = useHistoryManagement({ activeTab, searchQuery, sortOrder });

  const handleMoreMenu = () => {
    Alert.alert('히스토리 옵션', `총 ${tabCounts.all}개의 생성 이미지가 저장되어 있습니다.`, [
      { text: '닫기', style: 'cancel' },
      {
        text: '목록 새로고침',
        onPress: refreshImages,
      },
    ]);
  };

  // 3-column grid calculation
  const padding = 20;
  const gap = 8;
  const numColumns = 3;
  const cardWidth = Math.floor((width - padding * 2 - gap * (numColumns - 1)) / numColumns);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="히스토리"
        rightAction={
          <>
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
              <AppIcon color={showSearch ? 'accentText' : 'text'} name="Search" size="base" />
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
              <AppIcon color="text" name="ArrowUpDown" size="base" />
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
              <AppIcon color="text" name="EllipsisVertical" size="base" />
            </Pressable>
          </>
        }
      />

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
              <AppIcon color="muted" name="X" size="sm" />
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
            <AppIcon color="accentIcon" name="Sparkles" size="lg" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery
              ? '검색 결과가 없습니다'
              : activeTab === 'favorite'
                ? '즐겨찾기한 이미지가 없습니다'
                : '저장된 이미지가 없습니다'}
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
              imageUri={getStoredImageUri(item.fileName)}
              item={item}
              onPress={() => selectImage(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          windowSize={5}
        />
      )}

      {selectedId && filteredItems.length > 0 && (
        <HistoryImageViewer
          getImageFileSize={getImageFileSize}
          getImageUri={getStoredImageUri}
          items={filteredItems}
          key="history-image-viewer"
          onClose={closeViewer}
          onDelete={deleteImage}
          onSelect={selectImage}
          onToggleFavorite={toggleFavorite}
          selectedId={selectedId}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  pressed: {
    opacity: 0.72,
  },
});
