import { File, Paths } from 'expo-file-system';

import { parseDebugCrashLog, type DebugCrashLog } from './generation-diagnostics.ts';

export type { DebugCrashLog };

export async function loadDebugCrashLog(): Promise<DebugCrashLog | null> {
  const reportFile = new File(Paths.document, 'diagnostics', 'last-crash.json');
  if (reportFile.exists) {
    const parsed = parseDebugCrashLog(await reportFile.text());
    if (parsed?.source === 'report') return parsed;
  }

  const breadcrumbFile = new File(Paths.document, 'diagnostics', 'generation-run.json');
  if (breadcrumbFile.exists) {
    return parseDebugCrashLog(await breadcrumbFile.text());
  }

  return null;
}
