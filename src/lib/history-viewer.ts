import type { StoredImageMetadata } from '@/lib/image-metadata';

type ViewerItem = { id: string };

export type HistoryTab = 'all' | 'favorite';
export type HistorySortOrder = 'newest' | 'oldest';

export function createViewerItemsKey(items: ViewerItem[]): string {
  return items.map((item) => item.id).join('\u0000');
}

export function findViewerIndex(items: ViewerItem[], selectedId: string): number {
  const index = items.findIndex((item) => item.id === selectedId);
  return index < 0 ? 0 : index;
}

export function selectAfterViewerDelete(items: ViewerItem[], selectedId: string): string | null {
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  if (selectedIndex < 0) return null;
  return items[selectedIndex + 1]?.id ?? items[selectedIndex - 1]?.id ?? null;
}

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
