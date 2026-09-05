// Official Documentation:
// https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
// expo-file-system Next API Directory, File, and Paths

import { Directory, File, Paths } from 'expo-file-system';

import { getMetadataDatabase } from '@/lib/metadata-storage';
import {
  createImageMetadata,
  createRecoveredImageMetadata,
  ImageGenerationMetadataInput,
  StoredImageMetadata,
} from '@/lib/image-metadata';

const imagesDirectory = new Directory(Paths.document, 'images');

export function getStoredImageUri(fileName: string): string {
  return new File(imagesDirectory, fileName).uri;
}

export function getImageFile(fileName: string): File {
  return new File(imagesDirectory, fileName);
}

export function getImageFileSize(fileName: string): number | null {
  try {
    const file = new File(imagesDirectory, fileName);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

export function createImageDestination(input: ImageGenerationMetadataInput) {
  ensureDirectory();
  const metadata = createImageMetadata(input);
  const file = new File(imagesDirectory, metadata.fileName);
  return { file, metadata };
}

export async function loadStoredImages(): Promise<StoredImageMetadata[]> {
  ensureDirectory();
  const database = await getMetadataDatabase();
  const known = new Map<string, StoredImageMetadata>();
  for (const item of await database.listImages()) {
    if (new File(imagesDirectory, item.fileName).exists) known.set(item.fileName, item);
  }

  for (const entry of imagesDirectory.list()) {
    if (entry instanceof File && entry.name.endsWith('.png') && !entry.name.startsWith('.')) {
      if (!known.has(entry.name)) {
        const recovered = createRecoveredImageMetadata(entry.name);
        const stored = await database.recoverImage(recovered, () => entry.exists);
        if (stored) known.set(entry.name, stored);
      }
    }
  }

  const items = Array.from(known.values()).filter((item) => new File(imagesDirectory, item.fileName).exists);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export async function saveImageMetadata(metadata: StoredImageMetadata) {
  await (await getMetadataDatabase()).saveImage(metadata);
}

export async function toggleFavoriteImage(id: string): Promise<StoredImageMetadata> {
  return (await getMetadataDatabase()).toggleFavorite(id);
}

export async function deleteStoredImage(id: string): Promise<void> {
  await (await getMetadataDatabase()).deleteImage(id, (fileName) => {
    const file = new File(imagesDirectory, fileName);
    if (file.exists) file.delete();
  });
}

function ensureDirectory() {
  imagesDirectory.create({ idempotent: true, intermediates: true });
}
