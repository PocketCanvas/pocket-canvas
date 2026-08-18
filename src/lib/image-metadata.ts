// Official Documentation:
// https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
// TypeScript type definitions for image generation metadata & history

export type ImageResourceMetadata = {
  id: string;
  name: string;
  storedFileName: string;
};

export type ImageLoraMetadata = ImageResourceMetadata & { weight: number };

export type ImageGenerationMetadataInput = {
  prompt: string;
  model: ImageResourceMetadata;
  loras: ImageLoraMetadata[];
  steps: number;
};

export type StoredImageMetadata = ImageGenerationMetadataInput & {
  id: string;
  fileName: string;
  createdAt: string;
  favorite?: boolean;
};

export function createImageMetadata(
  input: ImageGenerationMetadataInput,
  date = new Date(),
  id = Math.random().toString(36).slice(2, 10),
): StoredImageMetadata {
  const createdAt = date.toISOString();
  const compactDate = `${createdAt.slice(0, 10).replaceAll('-', '')}-${createdAt
    .slice(11, 19)
    .replaceAll(':', '')}`;
  return { ...input, id, fileName: `${compactDate}-${id}.png`, createdAt, favorite: false };
}

export function isStoredImageMetadata(value: unknown): value is StoredImageMetadata {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.fileName === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.prompt === 'string' &&
    typeof item.steps === 'number' &&
    typeof item.model === 'object' &&
    item.model !== null &&
    typeof (item.model as Record<string, unknown>).id === 'string' &&
    typeof (item.model as Record<string, unknown>).name === 'string' &&
    Array.isArray(item.loras)
  );
}

export function parseDateFromFileName(fileName: string): string {
  const match = fileName.match(
    /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([a-zA-Z0-9]+)\.png$/i,
  );
  if (match) {
    const [, y, m, d, hh, mm, ss] = match;
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`;
  }
  return new Date().toISOString();
}

export function isCreatedToday(isoDateString: string): boolean {
  const date = new Date(isoDateString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
