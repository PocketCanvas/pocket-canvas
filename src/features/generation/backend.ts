export const INFERENCE_BACKENDS = ['vulkan', 'opencl'] as const;

export type InferenceBackend = (typeof INFERENCE_BACKENDS)[number];

export const DEFAULT_INFERENCE_BACKEND: InferenceBackend = 'vulkan';

export function isInferenceBackend(value: unknown): value is InferenceBackend {
  return value === 'vulkan' || value === 'opencl';
}

export function parseInferenceBackend(value: unknown): InferenceBackend {
  return isInferenceBackend(value) ? value : DEFAULT_INFERENCE_BACKEND;
}
