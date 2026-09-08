import assert from 'node:assert/strict';
import test from 'node:test';

import { filterHistoryItems } from './query.ts';

function image(id, createdAt, overrides = {}) {
  return {
    id,
    metadataStatus: 'complete',
    fileName: `${id}.png`,
    prompt: `${id} prompt`,
    negativePrompt: '',
    model: { id: 'model', name: 'Base model', storedFileName: 'model.gguf' },
    decoder: { type: 'vae' },
    loras: [],
    width: 512,
    height: 512,
    samplingPreset: 'lcm',
    steps: 4,
    cfgScale: 1,
    seed: 42,
    upscaler: { type: 'none', scale: 2, steps: 4, denoisingStrength: 0.7 },
    createdAt,
    favorite: false,
    ...overrides,
  };
}

const older = image('older', '2026-01-01T00:00:00.000Z', { favorite: true });
const newer = image('newer', '2026-01-02T00:00:00.000Z', {
  prompt: 'Mountain lake',
  model: { id: 'model', name: 'Landscape Model', storedFileName: 'model.gguf' },
  loras: [{ id: 'lora', name: 'Watercolor', storedFileName: 'lora.safetensors', weight: 0.8 }],
});

test('filters the favorite tab before sorting', () => {
  assert.deepEqual(filterHistoryItems([newer, older], 'favorite', '', 'newest'), [older]);
});

test('searches file names and complete generation metadata case-insensitively', () => {
  for (const query of ['NEWER.PNG', 'mountain', 'landscape', 'WATERCOLOR']) {
    assert.deepEqual(filterHistoryItems([older, newer], 'all', query, 'newest'), [newer]);
  }
});

test('sorts without mutating the source list', () => {
  const source = [older, newer];

  assert.deepEqual(filterHistoryItems(source, 'all', '', 'newest'), [newer, older]);
  assert.deepEqual(filterHistoryItems(source, 'all', '', 'oldest'), [older, newer]);
  assert.deepEqual(source, [older, newer]);
});
