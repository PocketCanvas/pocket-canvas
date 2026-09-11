import assert from 'node:assert/strict';
import test from 'node:test';

import { isInferenceBackend } from './store.ts';

test('accepts only vulkan and cpu inference backends', () => {
  assert.equal(isInferenceBackend('vulkan'), true);
  assert.equal(isInferenceBackend('cpu'), true);
  assert.equal(isInferenceBackend('opencl'), false);
  assert.equal(isInferenceBackend('default'), false);
  assert.equal(isInferenceBackend(''), false);
});
