import { Button, Host, Text } from '@expo/ui/jetpack-compose';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CompactSlider } from '@/components/compact-slider';
import { Colors } from '@/constants/theme';

export function GenerationControls({
  steps,
  onStepsChange,
  isGenerating,
  canGenerate,
  onGenerate,
}: {
  steps: number;
  onStepsChange: (steps: number) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const height = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const gesture = Gesture.Pan()
    .onBegin(() => {
      startY.set(translateY.get());
    })
    .onUpdate(({ translationY }) => {
      translateY.set(Math.max(0, Math.min(height.get() - 28, startY.get() + translationY)));
    })
    .onEnd(({ velocityY }) => {
      const hiddenY = Math.max(0, height.get() - 28);
      const shouldHide = velocityY > 400 || (velocityY >= -400 && translateY.get() > hiddenY / 2);
      translateY.set(withTiming(shouldHide ? hiddenY : 0, { duration: 180 }));
    });

  const toggle = () => {
    const hiddenY = Math.max(0, height.get() - 28);
    translateY.set(withTiming(translateY.get() > hiddenY / 2 ? 0 : hiddenY, { duration: 180 }));
  };

  return (
    <Animated.View
      onLayout={({ nativeEvent }) => {
        height.set(nativeEvent.layout.height);
      }}
      style={[styles.container, animatedStyle]}
    >
      <GestureDetector gesture={gesture}>
        <Pressable
          accessibilityHint="탭하거나 위아래로 밀어 생성 도구를 열고 닫습니다"
          accessibilityLabel="생성 도구 열기 또는 닫기"
          accessibilityRole="button"
          onPress={toggle}
          style={styles.handle}
        >
          <View style={styles.handleBar} />
        </Pressable>
      </GestureDetector>
      <View style={styles.stepHeader}>
        <View>
          <RNText style={styles.label}>추론 스텝</RNText>
          <RNText style={styles.stepHint}>LCM · 낮을수록 빠르게</RNText>
        </View>
        <View style={styles.stepBadge}>
          <RNText style={styles.stepValue}>{steps}</RNText>
        </View>
      </View>
      <Host style={styles.sliderHost} colorScheme="dark" seedColor={Colors.dark.accent}>
        <CompactSlider
          max={8}
          min={1}
          onValueChange={(value) => onStepsChange(Math.round(value))}
          steps={6}
          value={steps}
        />
      </Host>
      <Host style={styles.generateHost} colorScheme="dark" seedColor={Colors.dark.accent}>
        <Button
          colors={{
            containerColor: Colors.dark.accent,
            contentColor: Colors.dark.onAccent,
            disabledContainerColor: Colors.dark.disabled,
          }}
          enabled={!isGenerating && canGenerate}
          onClick={onGenerate}
        >
          <Text>{isGenerating ? '생성 중…' : '✦  이미지 생성'}</Text>
        </Button>
      </Host>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.dark.surface,
    borderTopColor: Colors.dark.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  handle: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -20,
    marginTop: -12,
  },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.dark.muted },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  stepHint: { color: Colors.dark.muted, fontSize: 11, marginTop: 2 },
  stepBadge: {
    minWidth: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.dark.accentSoft,
  },
  stepValue: { color: Colors.dark.accentText, fontSize: 15, fontWeight: '700' },
  sliderHost: { width: '100%', height: 42 },
  generateHost: { width: '100%', height: 50 },
});
