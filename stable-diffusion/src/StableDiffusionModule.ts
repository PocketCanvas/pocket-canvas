import { NativeModule, requireNativeModule } from 'expo';

import { StableDiffusionModuleEvents } from './StableDiffusion.types';

declare class StableDiffusionModule extends NativeModule<StableDiffusionModuleEvents> {
  getSystemInfo(): string;
  generateImage(
    prompt: string,
    modelUri: string,
    loraUris: string[],
    loraWeights: number[],
    steps: number,
    outputUri: string,
  ): Promise<string>;
}

export default requireNativeModule<StableDiffusionModule>('StableDiffusion');
