type ViewerItem = { id: string };

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
