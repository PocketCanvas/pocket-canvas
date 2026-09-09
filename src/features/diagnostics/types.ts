import type { NativeCrashFrame } from './tombstone-trace';

export const GENERATION_CRASH_SCHEMA_VERSION = 3;
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
  'variant',
  'variantEvidence',
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
  familyEvidence?: string;
  diffusionStorage?: string;
  diffusionBytes?: number;
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
