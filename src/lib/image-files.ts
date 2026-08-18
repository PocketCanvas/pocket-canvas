// Official Documentation:
// https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
// expo-file-system Next API Directory, File, and Paths

import { Directory, File, Paths } from 'expo-file-system';

import {
  createImageMetadata,
  ImageGenerationMetadataInput,
  isStoredImageMetadata,
  parseDateFromFileName,
  StoredImageMetadata,
} from '@/lib/image-metadata';

const imagesDirectory = new Directory(Paths.document, 'images');
const metadataFile = new File(imagesDirectory, 'meta.json');

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
  const known = new Map<string, StoredImageMetadata>();

  if (metadataFile.exists) {
    try {
      const raw = await metadataFile.text();
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (isStoredImageMetadata(item)) {
            const file = new File(imagesDirectory, item.fileName);
            if (file.exists) {
              known.set(item.fileName, item);
            }
          }
        }
      }
    } catch (error) {
      console.warn('images/meta.json 파싱 실패:', error);
    }
  }

  // Best-effort directory scan for orphaned PNG files (ADR-007)
  try {
    for (const entry of imagesDirectory.list()) {
      if (entry instanceof File && entry.name.endsWith('.png') && !entry.name.startsWith('.')) {
        if (!known.has(entry.name)) {
          const createdAt = parseDateFromFileName(entry.name);
          known.set(entry.name, {
            id: entry.name.replace(/\.png$/, ''),
            fileName: entry.name,
            prompt: '가져온 이미지',
            model: { id: 'unknown', name: '알 수 없음', storedFileName: '' },
            loras: [],
            steps: 4,
            createdAt,
            favorite: false,
          });
        }
      }
    }
  } catch (error) {
    console.warn('이미지 디렉토리 목록 조회 실패:', error);
  }

  const items = Array.from(known.values());
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export async function saveImageMetadata(metadata: StoredImageMetadata) {
  ensureDirectory();
  let images: StoredImageMetadata[] = [];
  if (metadataFile.exists) {
    try {
      const value: unknown = JSON.parse(await metadataFile.text());
      if (Array.isArray(value)) {
        images = value.filter(isStoredImageMetadata);
      }
    } catch {
      images = [];
    }
  }

  const filtered = images.filter(
    (img) => img.id !== metadata.id && img.fileName !== metadata.fileName,
  );
  const updated = [metadata, ...filtered];
  await writeImagesMetadata(updated);
}

export async function toggleFavoriteImage(id: string): Promise<StoredImageMetadata[]> {
  const images = await loadStoredImages();
  const updated = images.map((img) => (img.id === id ? { ...img, favorite: !img.favorite } : img));
  await writeImagesMetadata(updated);
  return updated;
}

export async function deleteStoredImage(id: string): Promise<StoredImageMetadata[]> {
  const images = await loadStoredImages();
  const target = images.find((img) => img.id === id);
  if (!target) throw new Error('삭제할 이미지를 찾을 수 없습니다.');

  const updated = images.filter((img) => img.id !== id);
  await writeImagesMetadata(updated);

  try {
    const file = new File(imagesDirectory, target.fileName);
    if (file.exists) file.delete();
  } catch (error) {
    await writeImagesMetadata(images);
    throw error;
  }

  return updated;
}

function ensureDirectory() {
  imagesDirectory.create({ idempotent: true, intermediates: true });
}

async function writeImagesMetadata(images: StoredImageMetadata[]) {
  ensureDirectory();
  const temporary = new File(imagesDirectory, '.meta.json.tmp');
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify(images));
  await temporary.move(metadataFile, { overwrite: true });
}
