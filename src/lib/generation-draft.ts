import type { BuiltInUpscalerType, SamplingPreset } from 'stable-diffusion';

import type { StoredModel } from '@/lib/model-files';

export type ImageSizeOption = {
  label: string;
  width: number;
  height: number;
  warning?: string;
};

export const IMAGE_SIZE_OPTIONS: ImageSizeOption[] = [
  { label: '256×256', width: 256, height: 256 },
  { label: '384×384', width: 384, height: 384 },
  { label: '512×512', width: 512, height: 512 },
  {
    label: '768×768',
    width: 768,
    height: 768,
    warning: '768×768 해상도는 모바일 기기 메모리 및 발열에 큰 부담이 될 수 있습니다.',
  },
];

export type GenerationLoraSelection = { model: StoredModel; weight: number };

export type GenerationDraft = {
  prompt: string;
  negativePrompt: string;
  resources: {
    model: StoredModel | null;
    taesd: StoredModel | null;
    loras: GenerationLoraSelection[];
  };
  sampling: {
    preset: SamplingPreset;
    steps: number;
    cfgScale: number;
  };
  imageSize: ImageSizeOption;
  seed: { fixed: boolean; value: number };
  hires: {
    type: BuiltInUpscalerType;
    scale: number;
    steps: number;
    denoisingStrength: number;
  };
};

export type GenerationDraftAction =
  | { type: 'promptChanged'; value: string }
  | { type: 'negativePromptChanged'; value: string }
  | { type: 'modelSelected'; model: StoredModel | null }
  | { type: 'taesdSelected'; taesd: StoredModel | null }
  | { type: 'lorasChanged'; loras: GenerationLoraSelection[] }
  | { type: 'samplingChanged'; changes: Partial<GenerationDraft['sampling']> }
  | { type: 'imageSizeSelected'; imageSize: ImageSizeOption }
  | { type: 'seedChanged'; value: number }
  | { type: 'fixedSeedToggled'; fixed: boolean }
  | { type: 'hiresChanged'; changes: Partial<GenerationDraft['hires']> }
  | { type: 'resourcesReconciled'; availableModels: StoredModel[] };

export function createInitialGenerationDraft(): GenerationDraft {
  return {
    prompt: '',
    negativePrompt: '',
    resources: { model: null, taesd: null, loras: [] },
    sampling: { preset: 'lcm', steps: 4, cfgScale: 1 },
    imageSize: IMAGE_SIZE_OPTIONS[2],
    seed: { fixed: false, value: -1 },
    hires: { type: 'none', scale: 2, steps: 4, denoisingStrength: 0.7 },
  };
}

export function generationDraftReducer(
  state: GenerationDraft,
  action: GenerationDraftAction,
): GenerationDraft {
  switch (action.type) {
    case 'promptChanged':
      return { ...state, prompt: action.value };
    case 'negativePromptChanged':
      return { ...state, negativePrompt: action.value };
    case 'modelSelected':
      return { ...state, resources: { ...state.resources, model: action.model } };
    case 'taesdSelected':
      return { ...state, resources: { ...state.resources, taesd: action.taesd } };
    case 'lorasChanged':
      return { ...state, resources: { ...state.resources, loras: action.loras } };
    case 'samplingChanged':
      return { ...state, sampling: { ...state.sampling, ...action.changes } };
    case 'imageSizeSelected':
      return { ...state, imageSize: action.imageSize };
    case 'seedChanged':
      return { ...state, seed: { ...state.seed, value: action.value } };
    case 'fixedSeedToggled':
      return {
        ...state,
        seed: { fixed: action.fixed, value: action.fixed ? state.seed.value : -1 },
      };
    case 'hiresChanged':
      return { ...state, hires: { ...state.hires, ...action.changes } };
    case 'resourcesReconciled': {
      const byId = new Map(action.availableModels.map((model) => [model.id, model]));
      return {
        ...state,
        resources: {
          model: state.resources.model ? (byId.get(state.resources.model.id) ?? null) : null,
          taesd: state.resources.taesd ? (byId.get(state.resources.taesd.id) ?? null) : null,
          loras: state.resources.loras.flatMap((selection) => {
            const model = byId.get(selection.model.id);
            return model ? [{ ...selection, model }] : [];
          }),
        },
      };
    }
  }
}
