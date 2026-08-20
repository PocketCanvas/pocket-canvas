// Official Documentation:
// https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
// TypeScript type definitions for image generation metadata & history

import type { BuiltInUpscaler, SamplingPreset } from 'stable-diffusion';

export type ImageResourceMetadata = {
  id: string;
  name: string;
  storedFileName: string;
};

export type ImageLoraMetadata = ImageResourceMetadata & { weight: number };

export type ImageDecoderMetadata =
  { type: 'vae' } | { type: 'taesd'; model: ImageResourceMetadata };

export type ImageGenerationMetadataInput = {
  prompt: string;
  negativePrompt: string;
  model: ImageResourceMetadata;
  decoder: ImageDecoderMetadata;
  loras: ImageLoraMetadata[];
  width: number;
  height: number;
  samplingPreset: SamplingPreset;
  steps: number;
  cfgScale: number;
  seed: number;
  upscaler: BuiltInUpscaler;
};

type StoredImageBase = {
  id: string;
  fileName: string;
  createdAt: string;
  favorite: boolean;
};

export type CompleteImageMetadata = ImageGenerationMetadataInput &
  StoredImageBase & { metadataStatus: 'complete' };

export type RecoveredImageMetadata = StoredImageBase & { metadataStatus: 'missing' };

export type StoredImageMetadata = CompleteImageMetadata | RecoveredImageMetadata;

export function createImageMetadata(
  input: ImageGenerationMetadataInput,
  date = new Date(),
  id = Math.random().toString(36).slice(2, 10),
): CompleteImageMetadata {
  const createdAt = date.toISOString();
  const compactDate = `${createdAt.slice(0, 10).replaceAll('-', '')}-${createdAt
    .slice(11, 19)
    .replaceAll(':', '')}`;
  return {
    ...input,
    metadataStatus: 'complete',
    id,
    fileName: `${compactDate}-${id}.png`,
    createdAt,
    favorite: false,
  };
}

export function createRecoveredImageMetadata(fileName: string): RecoveredImageMetadata {
  return {
    metadataStatus: 'missing',
    id: fileName.replace(/\.png$/i, ''),
    fileName,
    createdAt: parseDateFromFileName(fileName),
    favorite: false,
  };
}

export function isStoredImageMetadata(value: unknown): value is StoredImageMetadata {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const hasBaseFields =
    typeof item.id === 'string' &&
    typeof item.fileName === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.favorite === 'boolean';
  if (!hasBaseFields) return false;
  if (item.metadataStatus === 'missing') return true;
  if (item.metadataStatus !== 'complete') return false;

  const decoder = item.decoder as Record<string, unknown> | undefined;
  const upscaler = item.upscaler as Record<string, unknown> | undefined;
  return (
    typeof item.prompt === 'string' &&
    typeof item.negativePrompt === 'string' &&
    isImageResourceMetadata(item.model) &&
    (decoder?.type === 'vae' ||
      (decoder?.type === 'taesd' && isImageResourceMetadata(decoder.model))) &&
    Array.isArray(item.loras) &&
    item.loras.every(
      (lora) =>
        isImageResourceMetadata(lora) &&
        typeof (lora as unknown as Record<string, unknown>).weight === 'number',
    ) &&
    typeof item.width === 'number' &&
    typeof item.height === 'number' &&
    typeof item.samplingPreset === 'string' &&
    typeof item.steps === 'number' &&
    typeof item.cfgScale === 'number' &&
    typeof item.seed === 'number' &&
    typeof upscaler?.type === 'string' &&
    typeof upscaler.scale === 'number' &&
    typeof upscaler.steps === 'number' &&
    typeof upscaler.denoisingStrength === 'number'
  );
}

function parseDateFromFileName(fileName: string): string {
  const match = fileName.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-/);
  if (!match) return new Date().toISOString();
  const [, year, month, day, hours, minutes, seconds] = match;
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}

function isImageResourceMetadata(value: unknown): value is ImageResourceMetadata {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const resource = value as Record<string, unknown>;
  return (
    typeof resource.id === 'string' &&
    typeof resource.name === 'string' &&
    typeof resource.storedFileName === 'string'
  );
}
