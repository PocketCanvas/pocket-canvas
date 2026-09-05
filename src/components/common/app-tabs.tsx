import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();

  return (
    <NativeTabs
      labelVisibilityMode="labeled"
      backgroundColor={colors.surface}
      iconColor={{
        default: colors.muted,
        selected: colors.accent,
      }}
      indicatorColor={colors.accentSoft}
      labelStyle={{
        default: { color: colors.muted },
        selected: { color: colors.text, fontWeight: '700' },
      }}
      rippleColor={colors.accentSoft}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>생성</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="auto_awesome" sf="sparkles" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="models">
        <NativeTabs.Trigger.Label>모델</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="deployed_code" sf="cube.box" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>히스토리</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="history" sf="clock" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>설정</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="settings" sf="gearshape" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
