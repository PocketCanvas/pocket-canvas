import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { quantizeModel } from 'stable-diffusion';

import { getMetadataDatabase } from '@/lib/metadata-storage';
import {
  describeModel,
  inspectModelFile,
  inspectQuantizationAvailability,
  ModelFileFormat,
  ModelFileKind,
  type ModelDescriptor,
  type QuantizationAvailability,
  supportedModelExtension,
} from '@/lib/model-file-inspection';
import {
  createQuantizedModelRecord,
  type QuantizationType,
} from '@/lib/model-quantization';

export type StoredModel = {
  id: string;
  fileName: string;
  storedFileName: string;
  alias: string;
  kind: ModelFileKind;
  detectedKind: ModelFileKind;
  format: ModelFileFormat;
  sizeBytes: number;
  description: string;
  createdAt: string;
  quantization?: QuantizationType;
  sourceModelId?: string;
};

const modelsDirectory = new Directory(Paths.document, 'models');
let didCleanupIncompleteFiles = false;

export function getStoredModelUri(model: StoredModel) {
  return new File(modelsDirectory, model.storedFileName).uri;
}

export function inspectStoredModelQuantization(model: StoredModel): QuantizationAvailability {
  const file = new File(modelsDirectory, model.storedFileName);
  if (!file.exists) throw new Error('원본 모델 파일을 찾을 수 없습니다.');
  return inspectQuantizationAvailability(inspectFile(file));
}

export function inspectStoredModelDescriptor(model: StoredModel): ModelDescriptor {
  const file = new File(modelsDirectory, model.storedFileName);
  if (!file.exists) throw new Error('원본 모델 파일을 찾을 수 없습니다.');
  return describeModel(inspectFile(file), {
    originalFileName: model.fileName,
    alias: model.alias,
  });
}

export async function loadModels(): Promise<StoredModel[]> {
  return (await modelDatabase()).listModels();
}

async function modelDatabase() {
  ensureDirectory();
  if (!didCleanupIncompleteFiles) {
    cleanupIncompleteFiles();
    didCleanupIncompleteFiles = true;
  }
  return getMetadataDatabase();
}

export async function quantizeStoredModel(
  id: string,
  type: QuantizationType,
): Promise<{ model: StoredModel; models: StoredModel[] }> {
  const models = await loadModels();
  const source = models.find((model) => model.id === id);
  if (!source) throw new Error('양자화할 모델을 찾을 수 없습니다.');
  if (source.kind !== 'model') throw new Error('모델로 분류된 파일만 양자화할 수 있습니다.');

  const sourceFile = new File(modelsDirectory, source.storedFileName);
  if (!sourceFile.exists) throw new Error('원본 모델 파일을 찾을 수 없습니다.');

  const availability = inspectQuantizationAvailability(inspectFile(sourceFile));
  if (availability.type === 'alreadyQuantized') {
    throw new Error(`이미 ${availability.primaryType.toUpperCase()} 양자화가 적용된 모델입니다.`);
  }
  if (availability.type === 'unsupported') throw new Error(availability.reason);

  const outputId = createId();
  const temporary = new File(modelsDirectory, `.quantizing-${outputId}.gguf`);
  const destination = new File(modelsDirectory, `${outputId}.gguf`);
  let model: StoredModel;

  try {
    await quantizeModel(sourceFile.uri, temporary.uri, type);
    if (!temporary.exists || temporary.size <= 0) {
      throw new Error('양자화 결과 파일이 생성되지 않았습니다.');
    }

    const inspection = inspectFile(temporary);
    if (inspection.format !== 'gguf') throw new Error('양자화 결과가 GGUF 형식이 아닙니다.');
    await temporary.move(destination);

    model = createQuantizedModelRecord({
      source,
      type,
      id: outputId,
      sizeBytes: destination.size,
    });
    await (await getMetadataDatabase()).addModel(model);
  } catch (error) {
    if (temporary.exists) temporary.delete();
    if (destination.exists) destination.delete();
    throw error;
  }
  // The file is committed now; a subsequent catalog read must not roll it back.
  return { model, models: await (await getMetadataDatabase()).listModels() };
}

export async function pickAndImportModel(): Promise<StoredModel | null> {
  await modelDatabase();
  const selection = await getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (selection.canceled) return null;

  const asset = selection.assets[0];
  const source = new File(asset.uri);
  const extension = supportedModelExtension(asset.name);
  if (!extension) {
    throw new Error('GGUF 또는 SafeTensors 파일만 가져올 수 있습니다.');
  }

  ensureDirectory();
  const id = createId();
  const temporary = new File(modelsDirectory, `.importing-${id}${extension}`);
  const destination = new File(modelsDirectory, `${id}${extension}`);

  try {
    await source.copy(temporary);
    const inspection = inspectFile(temporary);
    await temporary.move(destination);

    const model: StoredModel = {
      id,
      fileName: asset.name,
      storedFileName: destination.name,
      alias: asset.name.slice(0, -extension.length),
      kind: inspection.kind,
      detectedKind: inspection.kind,
      format: inspection.format,
      sizeBytes: destination.size,
      description: '',
      createdAt: new Date().toISOString(),
    };

    try {
      await (await getMetadataDatabase()).addModel(model);
    } catch (error) {
      destination.delete();
      throw error;
    }
    return model;
  } catch (error) {
    if (temporary.exists) temporary.delete();
    throw error;
  }
}

export async function updateStoredModel(
  id: string,
  changes: Pick<StoredModel, 'alias' | 'kind' | 'description'>,
): Promise<StoredModel[]> {
  const database = await modelDatabase();
  await database.updateModel(id, changes);
  return database.listModels();
}

export async function deleteStoredModel(id: string): Promise<StoredModel[]> {
  const database = await modelDatabase();
  await database.deleteModel(id, (fileName) => {
    const file = new File(modelsDirectory, fileName);
    if (file.exists) file.delete();
  });
  return database.listModels();
}

function inspectFile(file: File) {
  const handle = file.open(FileMode.ReadOnly);
  try {
    return inspectModelFile({
      size: file.size,
      read(offset, length) {
        handle.offset = offset;
        return handle.readBytes(length);
      },
    });
  } finally {
    handle.close();
  }
}

function ensureDirectory() {
  modelsDirectory.create({ idempotent: true, intermediates: true });
}

function cleanupIncompleteFiles() {
  for (const entry of modelsDirectory.list()) {
    if (
      entry instanceof File &&
      (entry.name.startsWith('.importing-') || entry.name.startsWith('.quantizing-'))
    ) {
      entry.delete();
    }
  }
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
