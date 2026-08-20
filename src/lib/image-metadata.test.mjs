import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImageMetadata,
  createRecoveredImageMetadata,
  isStoredImageMetadata,
} from './image-metadata.ts';

test('creates a dated PNG name and preserves generation settings', () => {
  const metadata = createImageMetadata(
    {
      prompt: 'A cat in space',
      negativePrompt: 'blurry',
      model: { id: 'model-1', name: 'SD 1.5', storedFileName: 'model-1.gguf' },
      decoder: {
        type: 'taesd',
        model: { id: 'taesd-1', name: 'TAESD', storedFileName: 'taesd-1.safetensors' },
      },
      loras: [{ id: 'lora-1', name: 'LCM', storedFileName: 'lora-1.safetensors', weight: 0.8 }],
      width: 512,
      height: 512,
      samplingPreset: 'lcm',
      steps: 4,
      cfgScale: 1,
      seed: 42,
      upscaler: {
        type: 'latent_bicubic',
        scale: 2,
        steps: 4,
        denoisingStrength: 0.7,
      },
    },
    new Date('2026-08-17T12:34:56.000Z'),
    'abc123',
  );

  assert.equal(metadata.fileName, '20260817-123456-abc123.png');
  assert.equal(metadata.metadataStatus, 'complete');
  assert.equal(metadata.prompt, 'A cat in space');
  assert.equal(metadata.model.id, 'model-1');
  assert.equal(metadata.decoder.type, 'taesd');
  assert.equal(metadata.loras[0].weight, 0.8);
  assert.equal(metadata.steps, 4);
  assert.equal(metadata.samplingPreset, 'lcm');
  assert.equal(metadata.upscaler.scale, 2);
  assert.equal(metadata.favorite, false);
});

test('requires every current generation setting in stored metadata', () => {
  const valid = {
    id: 'img1',
    metadataStatus: 'complete',
    fileName: '20260817-123456-img1.png',
    prompt: 'A sunset on Mars',
    negativePrompt: '',
    model: { id: 'm1', name: 'SD 1.5', storedFileName: 'm1.gguf' },
    decoder: { type: 'vae' },
    loras: [],
    width: 512,
    height: 512,
    samplingPreset: 'lcm',
    steps: 4,
    cfgScale: 1,
    seed: 42,
    upscaler: { type: 'none', scale: 2, steps: 4, denoisingStrength: 0.7 },
    createdAt: '2026-08-17T12:34:56.000Z',
    favorite: true,
  };

  assert.equal(isStoredImageMetadata(valid), true);
  assert.equal(isStoredImageMetadata({ ...valid, negativePrompt: undefined }), false);
  assert.equal(isStoredImageMetadata({ ...valid, decoder: undefined }), false);
  assert.equal(isStoredImageMetadata({ ...valid, width: undefined }), false);
  assert.equal(isStoredImageMetadata({ ...valid, model: null }), false);
  assert.equal(isStoredImageMetadata({ ...valid, prompt: 123 }), false);
  assert.equal(
    isStoredImageMetadata({
      ...valid,
      upscaler: { type: 'latent', scale: '2', steps: 4, denoisingStrength: 0.7 },
    }),
    false,
  );
  assert.equal(isStoredImageMetadata(null), false);
});

test('represents a PNG without generation metadata as an explicit recovered image', () => {
  const recovered = createRecoveredImageMetadata('20260817-123456-abc123.png');

  assert.deepEqual(recovered, {
    metadataStatus: 'missing',
    id: '20260817-123456-abc123',
    fileName: '20260817-123456-abc123.png',
    createdAt: '2026-08-17T12:34:56.000Z',
    favorite: false,
  });
  assert.equal(isStoredImageMetadata(recovered), true);
});
