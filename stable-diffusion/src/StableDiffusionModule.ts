import { NativeModule, requireNativeModule } from 'expo';

declare class StableDiffusionModule extends NativeModule<{}> {
  getSystemInfo(): string;
}

export default requireNativeModule<StableDiffusionModule>('StableDiffusion');
