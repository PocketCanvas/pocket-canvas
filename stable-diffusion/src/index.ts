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
    options.loras.map(({ uri }) => uri),
    options.loras.map(({ weight }) => weight),
    options.steps,
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
