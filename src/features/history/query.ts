import type { StoredImageMetadata } from '@/features/images/metadata';

export type HistoryTab = 'all' | 'favorite';
export type HistorySortOrder = 'newest' | 'oldest';

export function filterHistoryItems(
  items: StoredImageMetadata[],
  activeTab: HistoryTab,
  searchQuery: string,
  sortOrder: HistorySortOrder,
) {
  let result = activeTab === 'favorite' ? items.filter((item) => item.favorite) : items;
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

  return [...result].sort((a, b) => {
    const difference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sortOrder === 'oldest' ? difference : -difference;
  });
}
