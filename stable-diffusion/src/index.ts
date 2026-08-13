import StableDiffusionModule from './StableDiffusionModule';

export function getSystemInfo(): string {
  return StableDiffusionModule.getSystemInfo();
}

export async function generateImage(prompt: string): Promise<string> {
  return await StableDiffusionModule.generateImage(prompt);
}

export { default as StableDiffusionModule } from './StableDiffusionModule';
export * from './StableDiffusion.types';
