export type GenerationStage = 'loading' | 'encoding' | 'sampling' | 'decoding';

export type GenerationProgressEvent = {
  stage: GenerationStage;
  step?: number;
  steps?: number;
};

export type StableDiffusionModuleEvents = {
  onProgress(event: GenerationProgressEvent): void;
};

export type GenerateImageOptions = {
  prompt: string;
  modelUri: string;
  loras: { uri: string; weight: number }[];
  steps: number;
  outputUri: string;
};
