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
import { Colors } from '@/constants/theme';

export type LoraSelection = { name: string; weight: number };

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
  const initialTop = index * SLOT_HEIGHT;
  const top = useSharedValue(initialTop);
  const dragY = useSharedValue(initialTop);
  const startY = useSharedValue(initialTop);
  const active = useSharedValue(false);
  const scale = useSharedValue(1);

  useAnimatedReaction(
    () => positions.get()[item.name],
    (index) => {
      if (!active.get()) top.set(withTiming(index * SLOT_HEIGHT, { duration: 140 }));
    },
    [item.name],
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
      startY.set(positions.get()[item.name] * SLOT_HEIGHT);
      dragY.set(startY.get());
    })
    .onUpdate(({ translationY }) => {
      dragY.set(Math.max(0, Math.min((count - 1) * SLOT_HEIGHT, startY.get() + translationY)));
      const from = positions.get()[item.name];
      const to = Math.max(0, Math.min(count - 1, Math.round(dragY.get() / SLOT_HEIGHT)));
      if (from === to) return;

      const next = { ...positions.get() };
      for (const name in next) {
        if (next[name] === to) {
          next[name] = from;
          break;
        }
      }
      next[item.name] = to;
      positions.set(next);
    })
    .onEnd(() => {
      const destination = positions.get()[item.name] * SLOT_HEIGHT;
      scale.set(withTiming(1, { duration: 70 }));
      top.set(dragY.get());
      active.set(false);
      top.set(withTiming(destination, { duration: 120 }));
      runOnJS(onDragEnd)(positions.get());
    });

  return (
    <Animated.View style={[styles.rowSlot, animatedStyle]}>
      <View style={styles.card}>
        <GestureDetector gesture={gesture}>
          <Pressable
            accessibilityActions={[
              { name: 'decrement', label: '위로 이동' },
              { name: 'increment', label: '아래로 이동' },
            ]}
            accessibilityLabel={`${item.name} 순서 변경`}
            accessibilityRole="adjustable"
            onAccessibilityAction={(event) =>
              onMove(
                item.name,
                event.nativeEvent.actionName === 'decrement'
                  ? Math.max(0, index - 1)
                  : Math.min(count - 1, index + 1),
              )
            }
            style={styles.handle}
          >
            <Text style={styles.handleText}>≡</Text>
          </Pressable>
        </GestureDetector>
        <View style={styles.body}>
          <View style={styles.header}>
            <Text numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.weight}>{item.weight.toFixed(1)}</Text>
            </View>
            <Pressable
              accessibilityLabel={`${item.name} 제거`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onRemove}
            >
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
          <Host style={styles.slider} colorScheme="dark" seedColor={Colors.dark.accent}>
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
  const positions = useSharedValue<Positions>(
    Object.fromEntries(loras.map((item, index) => [item.name, index])),
  );

  useEffect(() => {
    positions.set(Object.fromEntries(loras.map((item, index) => [item.name, index])));
  }, [loras, positions]);

  const move = (name: string, to: number) => {
    const from = loras.findIndex((item) => item.name === name);
    if (from < 0 || from === to) return;
    const next = [...loras];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };

  const commit = (nextPositions: Positions) => {
    onChange([...loras].sort((a, b) => nextPositions[a.name] - nextPositions[b.name]));
  };

  if (!loras.length) return <Text style={styles.empty}>선택된 LoRA가 없습니다.</Text>;

  return (
    <View style={{ height: loras.length * SLOT_HEIGHT }}>
      {loras.map((item, index) => (
        <SortableRow
          count={loras.length}
          index={index}
          item={item}
          key={item.name}
          onDragEnd={commit}
          onMove={move}
          onRemove={() => onChange(loras.filter((lora) => lora.name !== item.name))}
          onWeightChange={(weight) =>
            onChange(loras.map((lora) => (lora.name === item.name ? { ...lora, weight } : lora)))
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
    borderColor: Colors.dark.border,
    borderWidth: 1,
    backgroundColor: Colors.dark.surface,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightColor: Colors.dark.border,
    borderRightWidth: 1,
    backgroundColor: Colors.dark.surfaceRaised,
  },
  handleText: {
    color: Colors.dark.muted,
    fontSize: 22,
    fontWeight: '600',
    transform: [{ rotate: '90deg' }],
  },
  body: { flex: 1, paddingTop: 8, paddingRight: 10 },
  header: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10 },
  name: { flex: 1, color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  badge: {
    minWidth: 38,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: Colors.dark.accentSoft,
  },
  weight: { color: Colors.dark.accentText, fontSize: 12, fontWeight: '700' },
  remove: { color: Colors.dark.muted, fontSize: 22, lineHeight: 24 },
  slider: { width: '100%', height: 40 },
  empty: { color: Colors.dark.muted, fontSize: 13 },
});
