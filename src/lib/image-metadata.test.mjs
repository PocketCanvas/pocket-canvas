import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImageMetadata,
  isCreatedToday,
  isStoredImageMetadata,
  parseDateFromFileName,
} from './image-metadata.ts';

test('creates a dated PNG name and preserves generation settings', () => {
  const metadata = createImageMetadata(
    {
      prompt: 'A cat in space',
      model: { id: 'model-1', name: 'SD 1.5', storedFileName: 'model-1.gguf' },
      loras: [{ id: 'lora-1', name: 'LCM', storedFileName: 'lora-1.safetensors', weight: 0.8 }],
      steps: 4,
    },
    new Date('2026-08-17T12:34:56.000Z'),
    'abc123',
  );

  assert.equal(metadata.fileName, '20260817-123456-abc123.png');
  assert.equal(metadata.prompt, 'A cat in space');
  assert.equal(metadata.model.id, 'model-1');
  assert.equal(metadata.loras[0].weight, 0.8);
  assert.equal(metadata.steps, 4);
  assert.equal(metadata.favorite, false);
});

test('validates stored image metadata format', () => {
  const valid = {
    id: 'img1',
    fileName: '20260817-123456-img1.png',
    prompt: 'A sunset on Mars',
    model: { id: 'm1', name: 'SD 1.5', storedFileName: 'm1.gguf' },
    loras: [],
    steps: 4,
    createdAt: '2026-08-17T12:34:56.000Z',
    favorite: true,
  };

  assert.equal(isStoredImageMetadata(valid), true);
  assert.equal(isStoredImageMetadata({ ...valid, model: null }), false);
  assert.equal(isStoredImageMetadata({ ...valid, prompt: 123 }), false);
  assert.equal(isStoredImageMetadata(null), false);
});

test('parses date from dated PNG filename and identifies today', () => {
  const parsed = parseDateFromFileName('20260817-123456-abc123.png');
  assert.equal(parsed, '2026-08-17T12:34:56.000Z');

  const todayIso = new Date().toISOString();
  assert.equal(isCreatedToday(todayIso), true);
  assert.equal(isCreatedToday('2020-01-01T00:00:00.000Z'), false);
});
