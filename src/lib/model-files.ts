import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';

import {
  inspectModelFile,
  ModelFileFormat,
  ModelFileKind,
  supportedModelExtension,
} from '@/lib/model-file-inspection';

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
};

const modelsDirectory = new Directory(Paths.document, 'models');
const indexFile = new File(modelsDirectory, 'models.json');

export function getStoredModelUri(model: StoredModel) {
  return new File(modelsDirectory, model.storedFileName).uri;
}

export async function loadModels(): Promise<StoredModel[]> {
  ensureDirectory();
  cleanupIncompleteImports();
  if (!indexFile.exists) return [];

  const value: unknown = JSON.parse(await indexFile.text());
  if (!Array.isArray(value) || !value.every(isStoredModel)) {
    throw new Error('models.json 형식이 올바르지 않습니다.');
  }
  return value;
}

export async function pickAndImportModel(): Promise<StoredModel | null> {
  const selection = await DocumentPicker.getDocumentAsync({
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
      await writeModels([...(await loadModels()), model]);
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
  const models = await loadModels();
  const updated = models.map((model) => (model.id === id ? { ...model, ...changes } : model));
  if (!updated.some((model) => model.id === id)) throw new Error('모델을 찾을 수 없습니다.');
  await writeModels(updated);
  return updated;
}

export async function deleteStoredModel(id: string): Promise<StoredModel[]> {
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

function cleanupIncompleteImports() {
  for (const entry of modelsDirectory.list()) {
    if (entry instanceof File && entry.name.startsWith('.importing-')) entry.delete();
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
    model.sizeBytes >= 0
  );
}
