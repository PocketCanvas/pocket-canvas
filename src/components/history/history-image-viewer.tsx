import { setStringAsync } from 'expo-clipboard';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Check, ChevronLeft, Copy, Heart, Info, Share2, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated as RNAnimated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { getImageFileSize, getStoredImageUri } from '@/lib/image-files';
import { StoredImageMetadata } from '@/lib/image-metadata';
import { findViewerIndex } from '@/lib/history-viewer';
import { ZoomableHistoryGallery } from '@/components/history/zoomable-history-gallery';

type HistoryImageViewerProps = {
  items: StoredImageMetadata[];
  selectedId: string;
  onClose: () => void;
  onDelete: (item: StoredImageMetadata) => void;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export function HistoryImageViewer({
  items,
  selectedId,
  onClose,
  onDelete,
  onSelect,
  onToggleFavorite,
}: HistoryImageViewerProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const selectedIndex = findViewerIndex(items, selectedId);
  const selectedItem = items[selectedIndex];
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sheetOffset] = useState(() => new RNAnimated.Value(height));

  useEffect(() => {
    if (!detailsOpen) return;
    sheetOffset.setValue(height);
    RNAnimated.spring(sheetOffset, {
      toValue: 0,
      damping: 24,
      stiffness: 240,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [detailsOpen, height, sheetOffset]);

  const closeDetails = useCallback(() => {
    RNAnimated.timing(sheetOffset, {
      toValue: height,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setDetailsOpen(false));
  }, [height, sheetOffset]);

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => sheetOffset.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.9) {
          closeDetails();
        } else {
          RNAnimated.spring(sheetOffset, {
            toValue: 0,
            damping: 24,
            stiffness: 240,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  );

  const handleShare = async () => {
    if (!selectedItem) return;
    const uri = getStoredImageUri(selectedItem.fileName);
    try {
      if (await isAvailableAsync()) {
        await shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: '생성된 이미지 공유',
          UTI: 'public.png',
        });
      } else {
        await Share.share({ message: '[Pocket Canvas] 생성 이미지', url: uri });
      }
    } catch (error) {
      console.warn('공유 실패:', error);
    }
  };

  if (!selectedItem) return null;

  const topInset = Math.max(insets.top, 24) + 12;
  const bottomInset = Math.max(insets.bottom, 16) + 12;

  return (
    <Modal
      animationType="fade"
      onRequestClose={detailsOpen ? closeDetails : onClose}
      statusBarTranslucent
      visible
    >
      <GestureHandlerRootView style={viewerStyles.screen}>
        <View style={viewerStyles.screen}>
          <ZoomableHistoryGallery items={items} onSelect={onSelect} selectedIndex={selectedIndex} />

          <Pressable
            accessibilityLabel="이미지 뷰어 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              viewerStyles.backButton,
              { top: topInset },
              pressed && viewerStyles.pressed,
            ]}
          >
            <ChevronLeft color="#FFFFFF" size={26} />
          </Pressable>

          <Text style={[viewerStyles.positionText, { top: topInset + 7 }]}>
            {selectedIndex + 1} / {items.length}
          </Text>

          <View style={[viewerStyles.actionBar, { bottom: bottomInset }]}>
            <ViewerAction
              active={selectedItem.favorite}
              icon={
                <Heart
                  color={selectedItem.favorite ? colors.error : '#FFFFFF'}
                  fill={selectedItem.favorite ? colors.error : 'transparent'}
                  size={23}
                />
              }
              label={selectedItem.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
              onPress={() => onToggleFavorite(selectedItem.id)}
            />
            <ViewerAction
              active={detailsOpen}
              icon={<Info color={detailsOpen ? colors.accentText : '#FFFFFF'} size={23} />}
              label="상세 정보"
              onPress={() => (detailsOpen ? closeDetails() : setDetailsOpen(true))}
            />
            <ViewerAction
              icon={<Share2 color="#FFFFFF" size={23} />}
              label="공유"
              onPress={handleShare}
            />
            <ViewerAction
              icon={<Trash2 color="#FFFFFF" size={23} />}
              label="삭제"
              onPress={() => onDelete(selectedItem)}
            />
          </View>

          {detailsOpen && (
            <>
              <Pressable
                accessibilityLabel="상세 정보 닫기"
                onPress={closeDetails}
                style={[StyleSheet.absoluteFill, viewerStyles.sheetBackdrop]}
              />
              <RNAnimated.View
                accessibilityViewIsModal
                style={[
                  viewerStyles.sheet,
                  {
                    backgroundColor: colors.surfaceRaised,
                    transform: [{ translateY: sheetOffset }],
                  },
                ]}
              >
                <View
                  accessibilityHint="아래로 끌어 상세 정보를 닫습니다"
                  accessibilityLabel="상세 정보 시트 손잡이"
                  accessibilityRole="adjustable"
                  style={viewerStyles.dragArea}
                  {...panResponder.panHandlers}
                >
                  <View style={[viewerStyles.dragHandle, { backgroundColor: colors.muted }]} />
                </View>
                <ImageInformation item={selectedItem} />
              </RNAnimated.View>
            </>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ViewerAction({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [viewerStyles.action, pressed && viewerStyles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

function ImageInformation({ item }: { item: StoredImageMetadata }) {
  const colors = useTheme();
  const [copiedField, setCopiedField] = useState<'prompt' | 'negativePrompt' | null>(null);
  const complete = item.metadataStatus === 'complete' ? item : null;
  const fileSize = getImageFileSize(item.fileName);
  const loras = complete?.loras.length
    ? complete.loras.map((lora) => `${lora.name} (${lora.weight})`).join(', ')
    : '없음';
  const decoder = complete?.decoder.type === 'taesd' ? complete.decoder.model.name : '기본 VAE';
  const hires =
    !complete || complete.upscaler.type === 'none'
      ? '사용 안 함'
      : `${complete.upscaler.type} · ${complete.upscaler.scale}× · ${complete.upscaler.steps} steps · denoise ${complete.upscaler.denoisingStrength}`;

  const copyText = async (field: 'prompt' | 'negativePrompt', value: string) => {
    if (!(await setStringAsync(value))) return;
    setCopiedField(field);
    setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1800);
  };

  return (
    <ScrollView contentContainerStyle={viewerStyles.infoContent} showsVerticalScrollIndicator>
      <Text accessibilityRole="header" style={[viewerStyles.infoTitle, { color: colors.text }]}>
        상세 정보
      </Text>
      {complete ? (
        <>
          <InformationSection
            copied={copiedField === 'prompt'}
            label="프롬프트"
            onCopy={() => copyText('prompt', complete.prompt)}
            value={complete.prompt}
          />
          {complete.negativePrompt.length > 0 && (
            <InformationSection
              copied={copiedField === 'negativePrompt'}
              label="네거티브 프롬프트"
              onCopy={() => copyText('negativePrompt', complete.negativePrompt)}
              value={complete.negativePrompt}
            />
          )}
          <View style={viewerStyles.infoRows}>
            <InformationRow label="모델" value={complete.model.name} />
            <InformationRow label="디코더" value={decoder} />
            <InformationRow label="LoRA" value={loras} />
            <InformationRow label="해상도" value={`${complete.width}×${complete.height}`} />
            <InformationRow label="샘플링" value={complete.samplingPreset} />
            <InformationRow label="스텝 / CFG" value={`${complete.steps} / ${complete.cfgScale}`} />
            <InformationRow label="Seed" value={String(complete.seed)} />
            <InformationRow label="Hires" value={hires} />
          </View>
        </>
      ) : (
        <InformationSection
          label="생성 정보 없음"
          value="이미지는 보존됐지만 생성 설정을 기록하지 못했습니다."
        />
      )}
      <View style={viewerStyles.infoRows}>
        <InformationRow label="생성 일시" value={formatDateTime(item.createdAt)} />
        {fileSize !== null && <InformationRow label="파일 크기" value={formatBytes(fileSize)} />}
        <InformationRow label="파일명" value={item.fileName} />
      </View>
    </ScrollView>
  );
}

function InformationSection({
  copied = false,
  label,
  onCopy,
  value,
}: {
  copied?: boolean;
  label: string;
  onCopy?: () => void;
  value: string;
}) {
  const colors = useTheme();
  return (
    <View style={viewerStyles.infoSection}>
      <View style={viewerStyles.infoSectionHeader}>
        <Text style={[viewerStyles.infoLabel, { color: colors.muted }]}>{label}</Text>
        {onCopy && (
          <Pressable
            accessibilityLabel={`${label} ${copied ? '복사됨' : '복사'}`}
            accessibilityRole="button"
            onPress={onCopy}
            style={({ pressed }) => [viewerStyles.copyButton, pressed && viewerStyles.pressed]}
          >
            {copied ? (
              <Check color={colors.accentText} size={15} />
            ) : (
              <Copy color={colors.muted} size={15} />
            )}
            <Text
              style={[viewerStyles.copyText, { color: copied ? colors.accentText : colors.muted }]}
            >
              {copied ? '복사됨' : '복사'}
            </Text>
          </Pressable>
        )}
      </View>
      <View
        style={[
          viewerStyles.infoBox,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <Text selectable style={[viewerStyles.infoBody, { color: colors.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function InformationRow({ label, value }: { label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={[viewerStyles.infoRow, { borderTopColor: colors.border }]}>
      <Text style={[viewerStyles.infoRowLabel, { color: colors.muted }]}>{label}</Text>
      <Text selectable style={[viewerStyles.infoRowValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

const viewerStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  backButton: {
    position: 'absolute',
    left: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202125E6',
  },
  positionText: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: '#202125B3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionBar: {
    position: 'absolute',
    alignSelf: 'center',
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#202125F2',
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.62 },
  sheetBackdrop: { backgroundColor: '#00000066' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '68%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  dragArea: { height: 40, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 42, height: 4, borderRadius: 2, opacity: 0.65 },
  infoContent: { paddingHorizontal: 20, paddingBottom: 48 },
  infoTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  infoSection: { gap: 8, marginBottom: 18 },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  copyButton: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  copyText: { fontSize: 12, fontWeight: '600' },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoBody: { fontSize: 14, lineHeight: 21 },
  infoRows: { marginBottom: 18 },
  infoRow: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 11 },
  infoRowLabel: { width: 88, fontSize: 13 },
  infoRowValue: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
});
