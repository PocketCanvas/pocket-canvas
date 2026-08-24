export type GenerationStage = 'loading' | 'encoding' | 'sampling' | 'decoding';

export type QuantizationType = 'q8_0' | 'q5_0' | 'q5_1' | 'q4_0' | 'q4_1' | 'q4_K';
export type MemoryModelDescriptor = {
  family: 'sd1' | 'sdxl' | 'anima' | 'unknown';
  familyEvidence: 'tensor-signature' | 'insufficient';
  variant: 'turbo' | 'unknown';
  variantEvidence:
    | 'gguf-metadata'
    | 'safetensors-metadata'
    | 'original-file-name'
    | 'alias'
    | 'insufficient';
  diffusionStorage: 'f32' | 'f16' | 'bf16' | 'f8' | 'q4' | 'q5' | 'q8' | 'mixed' | 'unknown';
  diffusionBytes: number;
  vaeArchitecture: 'autoencoder-kl' | 'unknown';
};

export type GenerationProgressEvent = {
  stage: GenerationStage;
  step?: number;
  steps?: number;
};

export type QuantizationProgressEvent = {
  completedTensors: number;
  totalTensors: number;
};

export type StableDiffusionModuleEvents = {
  onProgress(event: GenerationProgressEvent): void;
  onQuantizationProgress(event: QuantizationProgressEvent): void;
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
  memoryModel?: MemoryModelDescriptor;
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
