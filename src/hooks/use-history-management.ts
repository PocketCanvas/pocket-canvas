// Official Documentation:
// https://docs.expo.dev/router/reference/hooks/#usefocuseffect

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import {
  filterHistoryItems,
  type HistorySortOrder,
  type HistoryTab,
} from '@/features/history/query';
import { selectAfterViewerDelete } from '@/features/history/viewer-navigation';
import type { StoredImageMetadata } from '@/features/images/metadata';
import { deleteStoredImage, loadStoredImages, toggleFavoriteImage } from '@/storage/image-storage';

type UseHistoryManagementOptions = {
  activeTab: HistoryTab;
  searchQuery: string;
  sortOrder: HistorySortOrder;
};

export function useHistoryManagement({
  activeTab,
  searchQuery,
  sortOrder,
}: UseHistoryManagementOptions) {
  const [items, setItems] = useState<StoredImageMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const filteredItems = filterHistoryItems(items, activeTab, searchQuery, sortOrder);
  const tabCounts = useMemo(
    () => ({
      all: items.length,
      favorite: items.filter((item) => item.favorite).length,
    }),
    [items],
  );

  const loadImages = useCallback(async () => {
    try {
      setItems(await loadStoredImages());
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
      void loadImages();
    }, [loadImages]),
  );

  const refreshImages = () => {
    setIsLoading(true);
    void loadImages();
  };

  const toggleFavorite = async (id: string) => {
    const nextSelectedId =
      activeTab === 'favorite' && selectedId === id
        ? selectAfterViewerDelete(filteredItems, id)
        : selectedId;

    setItems((current) =>
      current.map((image) => (image.id === id ? { ...image, favorite: !image.favorite } : image)),
    );
    setSelectedId(nextSelectedId);

    try {
      const updated = await toggleFavoriteImage(id);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      Alert.alert(
        '즐겨찾기를 변경하지 못했습니다.',
        error instanceof Error ? error.message : String(error),
      );
      void loadImages();
    }
  };

  const deleteImage = (item: StoredImageMetadata) => {
    Alert.alert('이미지를 삭제할까요?', '기기에서 영구히 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const nextSelectedId = selectAfterViewerDelete(filteredItems, item.id);
            await deleteStoredImage(item.id);
            setItems((current) => current.filter((image) => image.id !== item.id));
            setSelectedId(nextSelectedId);
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

  return {
    filteredItems,
    isLoading,
    selectedId,
    tabCounts,
    closeViewer: () => setSelectedId(null),
    deleteImage,
    refreshImages,
    selectImage: setSelectedId,
    toggleFavorite,
  };
}
