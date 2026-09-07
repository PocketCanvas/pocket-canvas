import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type IconName } from '@/components/common/app-icon';
import { useTheme, useThemeSettings } from '@/hooks/use-theme';
import type { ThemeMode } from '@/stores/theme-store';

type ThemeOption = {
  mode: ThemeMode;
  label: string;
  iconName: IconName;
};

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'system', label: '시스템 설정', iconName: 'Smartphone' },
  { mode: 'dark', label: '다크 모드', iconName: 'Moon' },
  { mode: 'light', label: '라이트 모드', iconName: 'Sun' },
];

type ThemeButtonProps = Omit<ThemeOption, 'mode'> & {
  colors: ReturnType<typeof useTheme>;
  isLast: boolean;
  isSelected: boolean;
  onPress: () => void;
};

export function ThemeSettings() {
  const colors = useTheme();
  const { themeMode, setThemeMode } = useThemeSettings();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>화면 테마</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {THEME_OPTIONS.map((option, index) => (
          <ThemeButton
            colors={colors}
            iconName={option.iconName}
            isLast={index === THEME_OPTIONS.length - 1}
            isSelected={themeMode === option.mode}
            key={option.mode}
            label={option.label}
            onPress={() => setThemeMode(option.mode)}
          />
        ))}
      </View>
    </View>
  );
}

function ThemeButton({ colors, iconName, isLast, isSelected, label, onPress }: ThemeButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        !isLast && [styles.borderBottom, { borderBottomColor: colors.border }],
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isSelected ? colors.accentSoft : colors.backgroundElement,
          },
        ]}
      >
        <AppIcon color={isSelected ? 'accentIcon' : 'muted'} name={iconName} size="md" />
      </View>

      <Text
        style={[styles.optionLabel, { color: isSelected ? colors.text : colors.textSecondary }]}
      >
        {label}
      </Text>

      <View
        style={[styles.radioCircle, { borderColor: isSelected ? colors.accent : colors.border }]}
      >
        {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: 0.72,
  },
});
