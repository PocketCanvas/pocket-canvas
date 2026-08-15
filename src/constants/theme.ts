/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#F7F7FB',
    surface: '#FFFFFF',
    surfaceRaised: '#ECECF1',
    border: '#ECECF1',
    text: '#1F2937',
    muted: '#6B7280',
    placeholder: '#9CA3AF',
    accent: '#7C3AED',
    accentSoft: '#EDE9FE',
    accentText: '#7C3AED',
    accentIcon: '#7C3AED',
    track: '#ECECF1',
    disabled: '#E5E7EB',
    error: '#B3261E',
    link: '#7C3AED',
    splash: '#7C3AED',
    onAccent: '#FFFFFF',
    backdrop: '#00000066',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECECF1',
    textSecondary: '#6B7280',
  },
  dark: {
    background: '#0F1115',
    surface: '#1C1F26',
    surfaceRaised: '#242832',
    border: '#303540',
    text: '#E5E7EB',
    muted: '#9DA3AE',
    placeholder: '#6F7580',
    accent: '#7C5CFF',
    accentSoft: '#2B2543',
    accentText: '#A78BFA',
    accentIcon: '#A78BFA',
    track: '#3B404A',
    disabled: '#34303F',
    error: '#FFB4AB',
    link: '#A78BFA',
    splash: '#7C5CFF',
    onAccent: '#FFFFFF',
    backdrop: '#00000099',
    backgroundElement: '#1C1F26',
    backgroundSelected: '#242832',
    textSecondary: '#9DA3AE',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
