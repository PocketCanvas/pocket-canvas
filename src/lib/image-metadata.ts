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
  return { ...input, id, fileName: `${compactDate}-${id}.png`, createdAt };
}
