import { parseGenerationCrashReport } from './report-parser.ts';
import { GENERATION_BREADCRUMB_KIND } from './types.ts';

export type DebugCrashLog = {
  source: 'report' | 'breadcrumb';
  title: string;
  detail: string;
};

export function parseDebugCrashLog(raw: string): DebugCrashLog | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  const report = parseGenerationCrashReport(value);
  if (report) {
    return {
      source: 'report',
      title: report.title,
      detail: JSON.stringify(report, null, 2),
    };
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'stage' in value &&
    typeof (value as { stage: unknown }).stage === 'string'
  ) {
    const stage = (value as { stage: string }).stage;
    const kind = (value as { kind?: string }).kind;
    if (kind != null && kind !== GENERATION_BREADCRUMB_KIND) return null;
    return {
      source: 'breadcrumb',
      title: `미완성 breadcrumb · ${stage}`,
      detail: JSON.stringify(value, null, 2),
    };
  }

  return null;
}
