import { crashFrameTopSymbol, type NativeCrashFrame } from './tombstone-trace.ts';

export const GENERATION_CRASH_SCHEMA_VERSION = 2;
export const GENERATION_CRASH_KIND = 'generation_crash';
export const GENERATION_BREADCRUMB_KIND = 'breadcrumb';

export const GENERATION_DIAGNOSTIC_FORBIDDEN_KEYS = [
  'prompt',
  'negativePrompt',
  'negative',
  'modelPath',
  'taesdPath',
  'outputPath',
  'alias',
  'fileName',
  'storedFileName',
  'uri',
  'seed',
] as const;

export type GenerationCrashStage =
  | 'loading'
  | 'lora_apply'
  | 'encoding'
  | 'text_encoding_prepare'
  | 'text_encoding_params'
  | 'text_encoding_compute'
  | 'sampling'
  | 'decoding';

export type GenerationBreadcrumb = {
  schemaVersion: number;
  kind: typeof GENERATION_BREADCRUMB_KIND;
  status: 'running';
  stage: GenerationCrashStage | string;
  samplingStep?: number;
  samplingSteps?: number;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  preset?: string;
  family?: string;
  variant?: string;
  familyEvidence?: string;
  diffusionStorage?: string;
  loraCount?: number;
  taesd?: boolean;
  hires?: boolean;
  memorySource?: string;
  memoryPolicy?: string;
  diffusionFa?: boolean;
  paramsBackend?: string;
  backend?: {
    diffusion: string;
    textEncoder: string;
    vae: string;
    textEncoderParams: string;
  };
  nativeTail?: string[];
  vaeTiling?: string;
  vulkanDevice?: string;
  vulkanApi?: string;
  vulkanDriver?: string;
};

export type GenerationCrashReport = {
  schemaVersion: number;
  kind: typeof GENERATION_CRASH_KIND;
  title: string;
  breadcrumb: GenerationBreadcrumb;
  device: Record<string, string | number>;
  exit: Record<string, string | number>;
  stack: {
    topSymbol: string | null;
    frames: NativeCrashFrame[];
  };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function collectJsonKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonKeys(item, keys);
    return keys;
  }
  if (!isPlainObject(value)) return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectJsonKeys(nested, keys);
  }
  return keys;
}

export function diagnosticContainsForbiddenKeys(value: unknown): string[] {
  const keys = collectJsonKeys(value);
  return GENERATION_DIAGNOSTIC_FORBIDDEN_KEYS.filter((key) => keys.has(key));
}

const USEFUL_STACK = /libstable_diffusion_bridge|ggml|libvulkan|Adreno|kgsl|<unknown>/i;
const SYMBOL_IN_FRAME = /\(([^)]+)\)/;
const SKIP_SYMBOL = /^(Java_expo|art::|kotlin|libc\.so)/;

export function selectCrashStackFrames(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => /^#\d+/.test(line) && USEFUL_STACK.test(line))
    .slice(0, 16);
}

export function crashTopSymbol(frames: string[]): string | null {
  for (const frame of frames) {
    const match = frame.match(SYMBOL_IN_FRAME);
    if (!match) continue;
    const symbol = match[1].replace(/\+\d+$/, '');
    if (!symbol || symbol === 'unknown' || SKIP_SYMBOL.test(symbol)) continue;
    return symbol;
  }
  return null;
}

export function crashSignalName(status: number | undefined, reason: string): string | null {
  if (reason !== 'crash_native' && reason !== 'signaled') return null;
  switch (status) {
    case 4:
      return 'SIGILL';
    case 5:
      return 'SIGTRAP';
    case 6:
      return 'SIGABRT';
    case 7:
      return 'SIGBUS';
    case 8:
      return 'SIGFPE';
    case 9:
      return 'SIGKILL';
    case 11:
      return 'SIGSEGV';
    default:
      return status != null ? `signal_${status}` : null;
  }
}

export function buildGenerationCrashTitle(input: {
  reason: string;
  status?: number;
  stage: string;
  topSymbol: string | null;
}): string {
  const signal = crashSignalName(input.status, input.reason);
  if (input.topSymbol && signal) return `native ${signal} at ${input.topSymbol}`;
  if (input.topSymbol) return `native crash at ${input.topSymbol}`;
  if (input.reason === 'low_memory') return `process killed: low memory during ${input.stage}`;
  if (signal) return `native ${signal} during ${input.stage}`;
  return `process died during ${input.stage} (${input.reason})`;
}

export function assembleGenerationCrashReport(input: {
  breadcrumb: Record<string, unknown>;
  device: Record<string, string | number>;
  exit: Record<string, string | number>;
  stackFrames: NativeCrashFrame[];
}): GenerationCrashReport | null {
  if (diagnosticContainsForbiddenKeys(input).length > 0) return null;
  const stage = typeof input.breadcrumb.stage === 'string' ? input.breadcrumb.stage : 'unknown';
  const reason = String(input.exit.reason ?? 'unknown');
  const status = typeof input.exit.status === 'number' ? input.exit.status : undefined;
  const frames = input.stackFrames.slice(0, 16);
  const topSymbol = crashFrameTopSymbol(frames);
  const breadcrumb = {
    ...input.breadcrumb,
    schemaVersion: GENERATION_CRASH_SCHEMA_VERSION,
    kind: GENERATION_BREADCRUMB_KIND,
    status: 'running',
    stage,
  } as GenerationBreadcrumb;
  return {
    schemaVersion: GENERATION_CRASH_SCHEMA_VERSION,
    kind: GENERATION_CRASH_KIND,
    title: buildGenerationCrashTitle({ reason, status, stage, topSymbol }),
    breadcrumb,
    device: input.device,
    exit: input.exit,
    stack: { topSymbol, frames },
  };
}

export function parseGenerationCrashReport(value: unknown): GenerationCrashReport | null {
  if (!isPlainObject(value)) return null;
  if (diagnosticContainsForbiddenKeys(value).length > 0) return null;
  if (value.schemaVersion !== GENERATION_CRASH_SCHEMA_VERSION) return null;
  if (value.kind !== GENERATION_CRASH_KIND) return null;
  if (typeof value.title !== 'string' || value.title.length === 0) return null;
  if (!isPlainObject(value.breadcrumb) || typeof value.breadcrumb.stage !== 'string') return null;
  if (!isPlainObject(value.exit) || typeof value.exit.reason !== 'string') return null;
  if (!isPlainObject(value.stack) || !Array.isArray(value.stack.frames)) return null;
  const frames = value.stack.frames.filter(isNativeCrashFrame);
  if (frames.length !== value.stack.frames.length) return null;
  return value as GenerationCrashReport;
}

function isNativeCrashFrame(value: unknown): value is NativeCrashFrame {
  return (
    isPlainObject(value) &&
    typeof value.library === 'string' &&
    typeof value.pc === 'string' &&
    typeof value.relPc === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.symbolOffset === 'number' &&
    typeof value.buildId === 'string'
  );
}

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

export function isGenerationCrashReport(
  record: GenerationCrashReport | null,
): record is GenerationCrashReport {
  return record?.kind === GENERATION_CRASH_KIND;
}
