import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageMetadata } from './image-metadata.ts';

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
});
