import { preventAutoHideAsync } from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { consumeInterruptedGeneration } from 'stable-diffusion';

import { AnimatedSplashOverlay } from '@/components/common/animated-icon';
import { useColorScheme } from '@/hooks/use-theme';
import {
  isGenerationCrashReport,
  parseGenerationCrashReport,
} from '@/features/diagnostics/report-parser';

preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    consumeInterruptedGeneration()
      .then((raw: string | null) => {
        if (!raw) return;
        const record = parseGenerationCrashReport(JSON.parse(raw) as unknown);
        if (!isGenerationCrashReport(record)) return;
        console.info('[crash]', record.title);
      })
      .catch((error: unknown) => {
        console.warn('중단된 생성 진단을 읽지 못했습니다.', error);
      });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onnx-poc" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
