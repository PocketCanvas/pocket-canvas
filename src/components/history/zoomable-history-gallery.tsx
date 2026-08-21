import { useCallback, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gallery } from 'react-native-zoom-toolkit';

import { getStoredImageUri } from '@/lib/image-files';
import { StoredImageMetadata } from '@/lib/image-metadata';
import { createViewerItemsKey } from '@/lib/history-viewer';

type ZoomableHistoryGalleryProps = {
  items: StoredImageMetadata[];
  onSelect: (id: string) => void;
  selectedIndex: number;
};

type Viewport = {
  height: number;
  width: number;
};

const MAX_SCALE = 4;

export function ZoomableHistoryGallery({
  items,
  onSelect,
  selectedIndex,
}: ZoomableHistoryGalleryProps) {
  const [viewport, setViewport] = useState<Viewport>({ height: 0, width: 0 });
  const galleryItemsKey = createViewerItemsKey(items);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setViewport((current) =>
      current.height === height && current.width === width ? current : { height, width },
    );
  }, []);

  const handleIndexChange = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) onSelect(item.id);
    },
    [items, onSelect],
  );

  const renderItem = useCallback(
    (item: StoredImageMetadata) => {
      const imageSize = getContainedImageSize(item, viewport);
      const accessibilityLabel =
        item.metadataStatus === 'complete' ? item.prompt : '생성 정보가 없는 저장 이미지';

      return (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={accessibilityLabel}
          resizeMode="contain"
          source={{ uri: getStoredImageUri(item.fileName) }}
          style={imageSize}
        />
      );
    },
    [viewport],
  );

  return (
    <View onLayout={handleLayout} style={styles.viewport}>
      {viewport.width > 0 && viewport.height > 0 && (
        <Gallery
          allowPinchPanning
          data={items}
          initialIndex={selectedIndex}
          key={galleryItemsKey}
          keyExtractor={(item) => item.id}
          maxScale={MAX_SCALE}
          onIndexChange={handleIndexChange}
          pinchMode="clamp"
          renderItem={renderItem}
          scaleMode="clamp"
          tapOnEdgeToItem={false}
          windowSize={3}
        />
      )}
    </View>
  );
}

function getContainedImageSize(item: StoredImageMetadata, viewport: Viewport) {
  if (item.metadataStatus !== 'complete' || item.width <= 0 || item.height <= 0) {
    return viewport;
  }

  const scale = Math.min(viewport.width / item.width, viewport.height / item.height);
  return {
    height: Math.round(item.height * scale),
    width: Math.round(item.width * scale),
  };
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
});
