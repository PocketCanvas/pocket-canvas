import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'dark' : (scheme ?? 'dark')];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
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
