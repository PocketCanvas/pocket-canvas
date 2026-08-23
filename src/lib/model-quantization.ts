import type { QuantizationType } from 'stable-diffusion';

import type { StoredModel } from '@/lib/model-files';

export type { QuantizationType } from 'stable-diffusion';

export type QuantizationOption = {
  value: QuantizationType;
  label: string;
  description: string;
};

export type QuantizationTask = {
  modelId: string;
  modelName: string;
  type: QuantizationType;
  completedTensors: number;
  totalTensors: number;
};

type QuantizationProgress = Pick<QuantizationTask, 'completedTensors' | 'totalTensors'>;

export const QUANTIZATION_OPTIONS: readonly QuantizationOption[] = [
  { value: 'q8_0', label: 'Q8_0', description: '가장 높은 품질, 가장 큰 파일' },
  { value: 'q5_0', label: 'Q5_0', description: '품질과 크기의 균형' },
  { value: 'q5_1', label: 'Q5_1', description: 'Q5_0보다 정밀한 5비트 방식' },
  { value: 'q4_0', label: 'Q4_0', description: '작은 파일을 위한 4비트 방식' },
  { value: 'q4_1', label: 'Q4_1', description: 'Q4_0보다 정밀한 4비트 방식' },
  { value: 'q4_K', label: 'Q4_K', description: '실기기 생성이 검증된 권장 방식' },
];

export function isQuantizationType(value: unknown): value is QuantizationType {
  return QUANTIZATION_OPTIONS.some((option) => option.value === value);
}

export function createQuantizationTask({
  modelId,
  modelName,
  type,
}: Pick<QuantizationTask, 'modelId' | 'modelName' | 'type'>): QuantizationTask {
  return { modelId, modelName, type, completedTensors: 0, totalTensors: 0 };
}

export function updateQuantizationTaskProgress(
  task: QuantizationTask,
  progress: QuantizationProgress,
): QuantizationTask {
  return { ...task, ...progress };
}

export function quantizationProgressPercent(progress: QuantizationProgress): number {
  if (progress.totalTensors <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((progress.completedTensors / progress.totalTensors) * 100)),
  );
}

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
