import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_INFERENCE_BACKEND, isInferenceBackend, parseInferenceBackend } from './backend.ts';

test('accepts vulkan and opencl as inference backends', () => {
  assert.equal(isInferenceBackend('vulkan'), true);
  assert.equal(isInferenceBackend('opencl'), true);
  assert.equal(isInferenceBackend('OpenCL'), false);
  assert.equal(isInferenceBackend('cpu'), false);
  assert.equal(isInferenceBackend(null), false);
});

test('defaults unknown backend selections to vulkan', () => {
  assert.equal(parseInferenceBackend('vulkan'), 'vulkan');
  assert.equal(parseInferenceBackend('opencl'), 'opencl');
  assert.equal(parseInferenceBackend(''), DEFAULT_INFERENCE_BACKEND);
  assert.equal(parseInferenceBackend('cuda'), DEFAULT_INFERENCE_BACKEND);
  assert.equal(parseInferenceBackend(undefined), DEFAULT_INFERENCE_BACKEND);
});
