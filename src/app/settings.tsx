import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/screen-header';
import { CrashLogPanel } from '@/components/settings/crash-log-panel';
import { ThemeSettings } from '@/components/settings/theme-settings';
import { useTheme } from '@/hooks/use-theme';
import { loadDebugCrashLog, type DebugCrashLog } from '@/lib/crash-log';

export default function SettingsScreen() {
  const colors = useTheme();
  const [crashLog, setCrashLog] = useState<DebugCrashLog | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDebugCrashLog()
        .then(setCrashLog)
        .catch(() => setCrashLog(null));
    }, []),
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader style={styles.header} title="설정" />

        <ThemeSettings />

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

        <CrashLogPanel log={crashLog} />
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
  borderBottom: {
    borderBottomWidth: 1,
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
});
