import { Button, Host, Text } from '@expo/ui/jetpack-compose';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CompactSlider } from '@/components/common/compact-slider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

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
  const colors = useTheme();
  const colorScheme = useColorScheme();
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
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Pressable
          accessibilityHint="탭하거나 위아래로 밀어 생성 도구를 열고 닫습니다"
          accessibilityLabel="생성 도구 열기 또는 닫기"
          accessibilityRole="button"
          onPress={toggle}
          style={styles.handle}
        >
          <View style={[styles.handleBar, { backgroundColor: colors.muted }]} />
        </Pressable>
      </GestureDetector>
      <View style={styles.stepHeader}>
        <RNText style={[styles.label, { color: colors.text }]}>추론 스텝</RNText>
        <View style={[styles.stepBadge, { backgroundColor: colors.accentSoft }]}>
          <RNText style={[styles.stepValue, { color: colors.accentText }]}>{steps}</RNText>
        </View>
      </View>
      <Host style={styles.sliderHost} colorScheme={colorScheme} seedColor={colors.accent}>
        <CompactSlider
          max={40}
          min={1}
          onValueChange={(value) => onStepsChange(Math.round(value))}
          steps={38}
          value={steps}
        />
      </Host>
      <Host style={styles.generateHost} colorScheme={colorScheme} seedColor={colors.accent}>
        <Button
          colors={{
            containerColor: colors.accent,
            contentColor: colors.onAccent,
            disabledContainerColor: colors.disabled,
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
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
  stepBadge: {
    minWidth: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  stepValue: { fontSize: 15, fontWeight: '700' },
  sliderHost: { width: '100%', height: 42 },
  generateHost: { width: '100%', height: 50 },
});
