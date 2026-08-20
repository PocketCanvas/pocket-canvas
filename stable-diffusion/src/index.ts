import type { EventSubscription } from 'expo-modules-core';

import StableDiffusionModule from './StableDiffusionModule';
import { GenerateImageOptions, GenerationProgressEvent } from './StableDiffusion.types';

export function getSystemInfo(): string {
  return StableDiffusionModule.getSystemInfo();
}

export async function generateImage(options: GenerateImageOptions): Promise<string> {
  const result = await StableDiffusionModule.generateImage(
    options.prompt,
    options.modelUri,
    options.taesdUri ?? '',
    options.loras.map(({ uri }) => uri),
    options.loras.map(({ weight }) => weight),
    {
      negativePrompt: options.negativePrompt,
      width: options.width,
      height: options.height,
      samplingPreset: options.samplingPreset,
      steps: options.steps,
      cfgScale: options.cfgScale,
      seed: options.seed,
      upscalerType: options.upscaler.type,
      upscaleFactor: options.upscaler.scale,
      hiresSteps: options.upscaler.steps,
      hiresDenoisingStrength: options.upscaler.denoisingStrength,
    },
    options.outputUri,
  );
  if (result.startsWith('Error')) throw new Error(result.slice(7));
  return result;
}

export function addProgressListener(
  listener: (event: GenerationProgressEvent) => void,
): EventSubscription {
  return StableDiffusionModule.addListener('onProgress', listener);
}

export { default as StableDiffusionModule } from './StableDiffusionModule';
export * from './StableDiffusion.types';
