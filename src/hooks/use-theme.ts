import { useEffect, useState } from 'react';
import { Platform, useColorScheme as useRNColorScheme } from 'react-native';
import { useStore } from 'zustand';

import { Colors } from '@/constants/theme';
import { themeStore } from '@/stores/theme-store';

export function useThemeSettings() {
  const themeMode = useStore(themeStore, (state) => state.themeMode);
  const setThemeMode = useStore(themeStore, (state) => state.setThemeMode);

  return { themeMode, setThemeMode };
}

export function useColorScheme(): 'light' | 'dark' {
  const systemScheme = useRNColorScheme();
  const themeMode = useStore(themeStore, (state) => state.themeMode);
  const [hasHydrated, setHasHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Expo static rendering must use a stable color scheme until client hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  if (Platform.OS === 'web') {
    return hasHydrated && systemScheme === 'dark' ? 'dark' : 'light';
  }
  if (themeMode === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }
  return themeMode;
}

export function useTheme() {
  const scheme = useColorScheme();
  return Colors[scheme];
}
