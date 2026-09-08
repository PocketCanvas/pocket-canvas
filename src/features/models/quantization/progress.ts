import type { QuantizationType } from './options';

export type QuantizationTask = {
  modelId: string;
  modelName: string;
  type: QuantizationType;
  completedTensors: number;
  totalTensors: number;
};

type QuantizationProgress = Pick<QuantizationTask, 'completedTensors' | 'totalTensors'>;

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
