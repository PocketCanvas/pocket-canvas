import { NativeModule, requireNativeModule } from 'expo';

import {
  QuantizationType,
  StableDiffusionModuleEvents,
  VaeMemoryProfile,
} from './StableDiffusion.types';

type NativeGenerationOptions = {
  negativePrompt: string;
  width: number;
  height: number;
  samplingPreset: string;
  steps: number;
  cfgScale: number;
  seed: number;
  upscalerType: string;
  upscaleFactor: number;
  hiresSteps: number;
  hiresDenoisingStrength: number;
  vaeMemoryProfile: VaeMemoryProfile;
};

declare class StableDiffusionModule extends NativeModule<StableDiffusionModuleEvents> {
  getSystemInfo(): string;
  quantizeModel(inputUri: string, outputUri: string, type: QuantizationType): Promise<string>;
  generateImage(
    prompt: string,
    modelUri: string,
    taesdUri: string,
    loraUris: string[],
    loraWeights: number[],
    options: NativeGenerationOptions,
    outputUri: string,
  ): Promise<string>;
}

export default requireNativeModule<StableDiffusionModule>('StableDiffusion');
