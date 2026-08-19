import { Host } from '@expo/ui/jetpack-compose';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { CompactSlider } from '@/components/compact-slider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { StoredModel } from '@/lib/model-files';

export type LoraSelection = { model: StoredModel; weight: number };

const ROW_HEIGHT = 82;
const ROW_GAP = 8;
const SLOT_HEIGHT = ROW_HEIGHT + ROW_GAP;

type Positions = Record<string, number>;

function SortableRow({
  item,
  index,
  count,
  positions,
  onDragEnd,
  onMove,
  onRemove,
  onWeightChange,
}: {
  item: LoraSelection;
  index: number;
  count: number;
  positions: SharedValue<Positions>;
  onDragEnd: (positions: Positions) => void;
  onMove: (name: string, to: number) => void;
  onRemove: () => void;
  onWeightChange: (weight: number) => void;
}) {
  const colors = useTheme();
  const colorScheme = useColorScheme();
  const initialTop = index * SLOT_HEIGHT;
  const top = useSharedValue(initialTop);
  const dragY = useSharedValue(initialTop);
  const startY = useSharedValue(initialTop);
  const active = useSharedValue(false);
  const scale = useSharedValue(1);

  useAnimatedReaction(
    () => positions.get()[item.model.id],
    (index) => {
      if (!active.get()) top.set(withTiming(index * SLOT_HEIGHT, { duration: 140 }));
    },
    [item.model.id],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: active.get() ? 2 : 1,
    transform: [{ translateY: active.get() ? dragY.get() : top.get() }, { scale: scale.get() }],
  }));

  const gesture = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      active.set(true);
      scale.set(withTiming(1.025, { duration: 70 }));
      startY.set(positions.get()[item.model.id] * SLOT_HEIGHT);
      dragY.set(startY.get());
    })
    .onUpdate(({ translationY }) => {
      dragY.set(Math.max(0, Math.min((count - 1) * SLOT_HEIGHT, startY.get() + translationY)));
      const from = positions.get()[item.model.id];
      const to = Math.max(0, Math.min(count - 1, Math.round(dragY.get() / SLOT_HEIGHT)));
      if (from === to) return;

      const next = { ...positions.get() };
      for (const name in next) {
        if (next[name] === to) {
          next[name] = from;
          break;
        }
      }
      next[item.model.id] = to;
      positions.set(next);
    })
    .onEnd(() => {
      const destination = positions.get()[item.model.id] * SLOT_HEIGHT;
      scale.set(withTiming(1, { duration: 70 }));
      top.set(dragY.get());
      active.set(false);
      top.set(withTiming(destination, { duration: 120 }));
      runOnJS(onDragEnd)(positions.get());
    });

  return (
    <Animated.View style={[styles.rowSlot, animatedStyle]}>
      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <GestureDetector gesture={gesture}>
          <Pressable
            accessibilityActions={[
              { name: 'decrement', label: '위로 이동' },
              { name: 'increment', label: '아래로 이동' },
            ]}
            accessibilityLabel={`${item.model.alias} 순서 변경`}
            accessibilityRole="adjustable"
            onAccessibilityAction={(event) =>
              onMove(
                item.model.id,
                event.nativeEvent.actionName === 'decrement'
                  ? Math.max(0, index - 1)
                  : Math.min(count - 1, index + 1),
              )
            }
            style={[
              styles.handle,
              {
                borderRightColor: colors.border,
                backgroundColor: colors.surfaceRaised,
              },
            ]}
          >
            <Text style={[styles.handleText, { color: colors.muted }]}>≡</Text>
          </Pressable>
        </GestureDetector>
        <View style={styles.body}>
          <View style={styles.header}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
              {item.model.alias}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.weight, { color: colors.accentText }]}>
                {item.weight.toFixed(1)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`${item.model.alias} 제거`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onRemove}
            >
              <Text style={[styles.remove, { color: colors.muted }]}>×</Text>
            </Pressable>
          </View>
          <Host style={styles.slider} colorScheme={colorScheme} seedColor={colors.accent}>
            <CompactSlider
              max={2}
              min={0}
              onValueChange={onWeightChange}
              steps={19}
              value={item.weight}
            />
          </Host>
        </View>
      </View>
    </Animated.View>
  );
}

export function LoraSortableList({
  loras,
  onChange,
}: {
  loras: LoraSelection[];
  onChange: (loras: LoraSelection[]) => void;
}) {
  const colors = useTheme();
  const positions = useSharedValue<Positions>(
    Object.fromEntries(loras.map((item, index) => [item.model.id, index])),
  );

  useEffect(() => {
    positions.set(Object.fromEntries(loras.map((item, index) => [item.model.id, index])));
  }, [loras, positions]);

  const move = (name: string, to: number) => {
    const from = loras.findIndex((item) => item.model.id === name);
    if (from < 0 || from === to) return;
    const next = [...loras];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };

  const commit = (nextPositions: Positions) => {
    onChange([...loras].sort((a, b) => nextPositions[a.model.id] - nextPositions[b.model.id]));
  };

  if (!loras.length)
    return <Text style={[styles.empty, { color: colors.muted }]}>선택된 LoRA가 없습니다.</Text>;

  return (
    <View style={{ height: loras.length * SLOT_HEIGHT }}>
      {loras.map((item, index) => (
        <SortableRow
          count={loras.length}
          index={index}
          item={item}
          key={item.model.id}
          onDragEnd={commit}
          onMove={move}
          onRemove={() => onChange(loras.filter((lora) => lora.model.id !== item.model.id))}
          onWeightChange={(weight) =>
            onChange(
              loras.map((lora) => (lora.model.id === item.model.id ? { ...lora, weight } : lora)),
            )
          }
          positions={positions}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowSlot: { height: SLOT_HEIGHT, paddingBottom: ROW_GAP },
  card: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    borderRadius: 11,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  handleText: {
    fontSize: 22,
    fontWeight: '600',
    transform: [{ rotate: '90deg' }],
  },
  body: { flex: 1, paddingTop: 8, paddingRight: 10 },
  header: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  badge: {
    minWidth: 38,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  weight: { fontSize: 12, fontWeight: '700' },
  remove: { fontSize: 22, lineHeight: 24 },
  slider: { width: '100%', height: 40 },
  empty: { fontSize: 13 },
});
