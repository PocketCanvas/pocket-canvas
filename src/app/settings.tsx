import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type IconName } from '@/components/common/app-icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { useTheme } from '@/hooks/use-theme';
import { ThemeMode, useThemeStore } from '@/stores/use-theme-store';

type ThemeOptionItem = {
  mode: ThemeMode;
  label: string;
  iconName: IconName;
};

export default function SettingsScreen() {
  const colors = useTheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);

  const themeOptions: ThemeOptionItem[] = [
    {
      mode: 'system',
      label: '시스템 설정',
      iconName: 'Smartphone',
    },
    {
      mode: 'dark',
      label: '다크 모드',
      iconName: 'Moon',
    },
    {
      mode: 'light',
      label: '라이트 모드',
      iconName: 'Sun',
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader style={styles.header} title="설정" />

        {/* 1. 화면 테마 섹션 */}
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
            {themeOptions.map((option, index) => {
              const isSelected = themeMode === option.mode;
              const isLast = index === themeOptions.length - 1;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  key={option.mode}
                  onPress={() => setThemeMode(option.mode)}
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
                    <AppIcon
                      color={isSelected ? 'accentIcon' : 'muted'}
                      name={option.iconName}
                      size="md"
                    />
                  </View>

                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>

                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: isSelected ? colors.accent : colors.border },
                    ]}
                  >
                    {isSelected && (
                      <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 2. 앱 정보 섹션 */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>앱 정보</Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.infoRow, styles.borderBottom, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.infoLabel, { color: colors.text }]}>앱 이름</Text>
              <Text style={[styles.infoValue, { color: colors.muted }]}>Pocket Canvas</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text }]}>버전</Text>
              <Text style={[styles.infoValue, { color: colors.muted }]}>0.1.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
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
  infoRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
