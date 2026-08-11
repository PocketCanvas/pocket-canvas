import StableDiffusionModule from './StableDiffusionModule';

export function getSystemInfo(): string {
  return StableDiffusionModule.getSystemInfo();
}

export { default as StableDiffusionModule } from './StableDiffusionModule';
export * from './StableDiffusion.types';
