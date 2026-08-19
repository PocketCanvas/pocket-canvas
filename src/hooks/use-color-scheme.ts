import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/use-theme-store';

export function useColorScheme(): 'light' | 'dark' {
  const systemScheme = useRNColorScheme() ?? 'dark';
  const themeMode = useThemeStore((state) => state.themeMode);

  if (themeMode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return themeMode;
}
