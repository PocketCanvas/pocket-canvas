import type { StoredModel } from '@/features/models/model';

import type { QuantizationType } from './options';

export function createQuantizedModelRecord({
  source,
  type,
  id,
  sizeBytes,
  createdAt = new Date().toISOString(),
}: {
  source: StoredModel;
  type: QuantizationType;
  id: string;
  sizeBytes: number;
  createdAt?: string;
}): StoredModel {
  return {
    id,
    fileName: `${source.alias}-${type}.gguf`,
    storedFileName: `${id}.gguf`,
    alias: `${source.alias} (${type.toUpperCase()})`,
    kind: 'model',
    detectedKind: 'model',
    format: 'gguf',
    sizeBytes,
    description: source.description,
    createdAt,
    quantization: type,
    sourceModelId: source.id,
  };
}
