import { NativeModule, requireNativeModule } from 'expo';

declare class StableDiffusionModule extends NativeModule<{}> {
  getSystemInfo(): string;
  generateImage(prompt: string): Promise<string>;
}

export default requireNativeModule<StableDiffusionModule>('StableDiffusion');
