import { setStringAsync } from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/common/app-icon';
import { Fonts } from '@/shared/theme/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { DebugCrashLog } from '@/features/diagnostics/debug-log';

type CrashLogPanelProps = {
  log: DebugCrashLog | null;
};

export function CrashLogPanel({ log }: CrashLogPanelProps) {
  const colors = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLog = async () => {
    if (!log) return;
    if (!(await setStringAsync(log.detail))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>디버그</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="크래시 로그 펼치기"
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
        >
          <View style={styles.summaryText}>
            <Text style={[styles.infoLabel, { color: colors.text }]}>크래시 로그</Text>
            <Text
              style={[styles.infoValue, { color: colors.muted }]}
              numberOfLines={expanded ? 0 : 2}
            >
              {log?.title ?? '기록된 크래시가 없습니다'}
            </Text>
          </View>
          {log ? (
            <AppIcon color="muted" name={expanded ? 'ChevronDown' : 'ChevronRight'} size="md" />
          ) : null}
        </Pressable>

        {expanded && log ? (
          <View style={[styles.detail, { borderTopColor: colors.border }]}>
            {log.source === 'breadcrumb' ? (
              <Text style={[styles.hint, { color: colors.warning }]}>
                앱을 다시 열면 종료 사유와 스택이 붙은 보고서로 완성됩니다.
              </Text>
            ) : null}
            <Text selectable style={[styles.json, { color: colors.textSecondary }]}>
              {log.detail}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="크래시 로그 복사"
              onPress={copyLog}
              style={({ pressed }) => [
                styles.copyButton,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                color={copied ? 'accentIcon' : 'muted'}
                name={copied ? 'Check' : 'Copy'}
                size="sm"
              />
              <Text
                style={[styles.copyLabel, { color: copied ? colors.accentText : colors.muted }]}
              >
                {copied ? '복사됨' : '복사'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
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
  summaryRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  summaryText: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
  },
  detail: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  json: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.mono,
  },
  copyButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  copyLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
