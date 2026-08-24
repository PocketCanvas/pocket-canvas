import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { quantizeModel } from 'stable-diffusion';

import { createAsyncOperationQueue } from '@/lib/async-operation-queue';
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
  isQuantizationType,
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
const indexFile = new File(modelsDirectory, 'models.json');
const enqueueModelIndexOperation = createAsyncOperationQueue();
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
  ensureDirectory();
  if (!didCleanupIncompleteFiles) {
    cleanupIncompleteFiles();
    didCleanupIncompleteFiles = true;
  }
  if (!indexFile.exists) return [];

  const value: unknown = JSON.parse(await indexFile.text());
  if (!Array.isArray(value) || !value.every(isStoredModel)) {
    throw new Error('models.json 형식이 올바르지 않습니다.');
  }
  return value;
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

  try {
    await quantizeModel(sourceFile.uri, temporary.uri, type);
    if (!temporary.exists || temporary.size <= 0) {
      throw new Error('양자화 결과 파일이 생성되지 않았습니다.');
    }

    const inspection = inspectFile(temporary);
    if (inspection.format !== 'gguf') throw new Error('양자화 결과가 GGUF 형식이 아닙니다.');
    await temporary.move(destination);

    const model = createQuantizedModelRecord({
      source,
      type,
      id: outputId,
      sizeBytes: destination.size,
    });
    try {
      const updated = await enqueueModelIndexOperation(async () => {
        const current = await loadModels();
        const next = [...current, model];
        await writeModels(next);
        return next;
      });
      return { model, models: updated };
    } catch (error) {
      if (destination.exists) destination.delete();
      throw error;
    }
  } catch (error) {
    if (temporary.exists) temporary.delete();
    if (destination.exists) destination.delete();
    throw error;
  }
}

export async function pickAndImportModel(): Promise<StoredModel | null> {
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
      await enqueueModelIndexOperation(async () => {
        const current = await loadModels();
        await writeModels([...current, model]);
      });
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
  return enqueueModelIndexOperation(async () => {
    const models = await loadModels();
    const updated = models.map((model) => (model.id === id ? { ...model, ...changes } : model));
    if (!updated.some((model) => model.id === id)) throw new Error('모델을 찾을 수 없습니다.');
    await writeModels(updated);
    return updated;
  });
}

export async function deleteStoredModel(id: string): Promise<StoredModel[]> {
  return enqueueModelIndexOperation(async () => {
    const models = await loadModels();
    const target = models.find((model) => model.id === id);
    if (!target) throw new Error('모델을 찾을 수 없습니다.');

    const updated = models.filter((model) => model.id !== id);
    await writeModels(updated);
    try {
      const file = new File(modelsDirectory, target.storedFileName);
      if (file.exists) file.delete();
    } catch (error) {
      await writeModels(models);
      throw error;
    }
    return updated;
  });
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

async function writeModels(models: StoredModel[]) {
  const temporaryIndex = new File(modelsDirectory, '.models.json.tmp');
  temporaryIndex.create({ overwrite: true });
  temporaryIndex.write(JSON.stringify(models));
  await temporaryIndex.move(indexFile, { overwrite: true });
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isStoredModel(value: unknown): value is StoredModel {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const model = value as Record<string, unknown>;
  return (
    ['id', 'fileName', 'storedFileName', 'alias', 'description', 'createdAt'].every(
      (key) => typeof model[key] === 'string',
    ) &&
    ['model', 'lora', 'unknown'].includes(String(model.kind)) &&
    ['model', 'lora', 'unknown'].includes(String(model.detectedKind)) &&
    ['gguf', 'safetensors'].includes(String(model.format)) &&
    typeof model.sizeBytes === 'number' &&
    Number.isSafeInteger(model.sizeBytes) &&
    model.sizeBytes >= 0 &&
    (model.quantization === undefined || isQuantizationType(model.quantization)) &&
    (model.sourceModelId === undefined || typeof model.sourceModelId === 'string')
  );
}
