import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GenerationProgressEvent } from 'stable-diffusion';

import { useTheme } from '@/hooks/use-theme';
import { generationProgressDetail } from '@/lib/generation-progress';

const GENERATION_STAGES: { stage: GenerationProgressEvent['stage']; label: string }[] = [
  { stage: 'loading', label: 'Loading' },
  { stage: 'encoding', label: 'Encoding' },
  { stage: 'sampling', label: 'Steps' },
  { stage: 'decoding', label: 'Decoding' },
];

type GenerationProgressProps = {
  progress: GenerationProgressEvent | null;
};

export function GenerationProgress({ progress }: GenerationProgressProps) {
  const colors = useTheme();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const current = Math.max(
    0,
    GENERATION_STAGES.findIndex(({ stage }) => stage === progress?.stage),
  );
  const step = progress?.step ?? 0;
  const steps = progress?.steps ?? 0;
  const currentProgress = progress ?? { stage: 'loading' };
  const detail = generationProgressDetail(currentProgress, elapsedSeconds);
  const accessibilityLabel =
    currentProgress.stage === 'sampling'
      ? `Steps ${step}/${steps}`
      : GENERATION_STAGES[current].label;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.progressBlock}
    >
      <View accessible={false} style={styles.progressStages}>
        {GENERATION_STAGES.map(({ stage, label }, index) => {
          let stageColor: string = colors.muted;
          if (index === current) {
            stageColor = colors.accentText;
          } else if (index < current) {
            stageColor = colors.textSecondary;
          }

          return (
            <View key={stage} style={styles.progressStages}>
              {index > 0 && <Text style={[styles.progressArrow, { color: colors.border }]}>›</Text>}
              <Text style={[styles.progressStage, { color: stageColor }]}>{label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.progressDetail, { color: colors.text }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progressBlock: { alignItems: 'center', gap: 8 },
  progressStages: { flexDirection: 'row', alignItems: 'center' },
  progressStage: { fontSize: 12, fontWeight: '600' },
  progressArrow: { fontSize: 12, marginHorizontal: 5 },
  progressDetail: { fontSize: 14, fontWeight: '600' },
});
