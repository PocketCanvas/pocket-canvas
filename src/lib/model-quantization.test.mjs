import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createQuantizationTask,
  createQuantizedModelRecord,
  quantizationProgressPercent,
  QUANTIZATION_OPTIONS,
  updateQuantizationTaskProgress,
} from './model-quantization.ts';

test('exposes only the quantization types supported by the app contract', () => {
  assert.deepEqual(
    QUANTIZATION_OPTIONS.map(({ value }) => value),
    ['q8_0', 'q5_0', 'q5_1', 'q4_0', 'q4_1', 'q4_K'],
  );
});

test('creates a separate GGUF record while preserving the source model', () => {
  const source = {
    id: 'source-id',
    fileName: 'original.safetensors',
    storedFileName: 'source-id.safetensors',
    alias: 'Original',
    kind: 'model',
    detectedKind: 'model',
    format: 'safetensors',
    sizeBytes: 4_000,
    description: 'source description',
    createdAt: '2026-08-22T00:00:00.000Z',
  };

  const result = createQuantizedModelRecord({
    source,
    type: 'q4_K',
    id: 'quantized-id',
    sizeBytes: 1_500,
    createdAt: '2026-08-22T01:00:00.000Z',
  });

  assert.deepEqual(result, {
    id: 'quantized-id',
    fileName: 'Original-q4_K.gguf',
    storedFileName: 'quantized-id.gguf',
    alias: 'Original (Q4_K)',
    kind: 'model',
    detectedKind: 'model',
    format: 'gguf',
    sizeBytes: 1_500,
    description: 'source description',
    createdAt: '2026-08-22T01:00:00.000Z',
    quantization: 'q4_K',
    sourceModelId: 'source-id',
  });
});

test('tracks the source model, quantization type, and tensor progress', () => {
  const started = createQuantizationTask({
    modelId: 'source-id',
    modelName: 'Original',
    type: 'q4_K',
  });

  assert.deepEqual(started, {
    modelId: 'source-id',
    modelName: 'Original',
    type: 'q4_K',
    completedTensors: 0,
    totalTensors: 0,
  });

  const progressed = updateQuantizationTaskProgress(started, {
    completedTensors: 55,
    totalTensors: 100,
  });

  assert.deepEqual(progressed, {
    ...started,
    completedTensors: 55,
    totalTensors: 100,
  });
  assert.equal(quantizationProgressPercent(progressed), 55);
});

test('keeps quantization progress percentage within the display range', () => {
  assert.equal(quantizationProgressPercent({ completedTensors: 3, totalTensors: 0 }), 0);
  assert.equal(quantizationProgressPercent({ completedTensors: 120, totalTensors: 100 }), 100);
});
