import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeState = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

export const themeStore = createStore<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'pocket-canvas-theme-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
