import { Directory, File, Paths } from 'expo-file-system';

import {
  createImageMetadata,
  ImageGenerationMetadataInput,
  StoredImageMetadata,
} from '@/lib/image-metadata';

const imagesDirectory = new Directory(Paths.document, 'images');
const metadataFile = new File(imagesDirectory, 'meta.json');

export function createImageDestination(input: ImageGenerationMetadataInput) {
  imagesDirectory.create({ idempotent: true, intermediates: true });
  const metadata = createImageMetadata(input);
  const file = new File(imagesDirectory, metadata.fileName);
  return { file, metadata };
}

export async function saveImageMetadata(metadata: StoredImageMetadata) {
  let images: StoredImageMetadata[] = [];
  if (metadataFile.exists) {
    const value: unknown = JSON.parse(await metadataFile.text());
    if (!Array.isArray(value)) throw new Error('images/meta.json 형식이 올바르지 않습니다.');
    images = value as StoredImageMetadata[];
  }

  const temporary = new File(imagesDirectory, '.meta.json.tmp');
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify([...images, metadata]));
  await temporary.move(metadataFile, { overwrite: true });
}
