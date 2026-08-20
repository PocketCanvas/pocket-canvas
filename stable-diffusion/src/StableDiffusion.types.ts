export type GenerationStage = 'loading' | 'encoding' | 'sampling' | 'decoding';

export type GenerationProgressEvent = {
  stage: GenerationStage;
  step?: number;
  steps?: number;
};

export type StableDiffusionModuleEvents = {
  onProgress(event: GenerationProgressEvent): void;
};

export type SamplingPreset =
  | 'euler' | 'euler_a' | 'heun' | 'dpm2' | 'dpmpp_2s_a' | 'dpmpp_2m'
  | 'dpmpp_2m_karras' | 'dpmpp_2m_v2' | 'ipndm' | 'ipndm_v' | 'lcm' | 'ddim'
  | 'tcd' | 'res_multistep' | 'res_2s' | 'er_sde' | 'euler_cfg_pp'
  | 'euler_a_cfg_pp' | 'euler_ge' | 'dpmpp_2m_sde' | 'dpmpp_2m_sde_karras'
  | 'dpmpp_2m_sde_bt' | 'lms';

export type BuiltInUpscalerType =
  | 'none' | 'latent' | 'latent_nearest' | 'latent_nearest_exact'
  | 'latent_antialiased' | 'latent_bicubic' | 'latent_bicubic_antialiased'
  | 'lanczos' | 'nearest';

export type BuiltInUpscaler = {
  type: BuiltInUpscalerType;
  scale: number;
  steps: number;
  denoisingStrength: number;
};

export type GenerateImageOptions = {
  prompt: string;
  negativePrompt: string;
  modelUri: string;
  taesdUri?: string;
  loras: { uri: string; weight: number }[];
  width: number;
  height: number;
  samplingPreset: SamplingPreset;
  steps: number;
  cfgScale: number;
  seed: number;
  upscaler: BuiltInUpscaler;
  outputUri: string;
};
