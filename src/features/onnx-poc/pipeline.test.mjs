import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ONNX_POC_PROMPT,
  ONNX_POC_REQUIRED_FILES,
  isOnnxPocBackend,
  isOnnxPocSize,
  parseOnnxPocGeneration,
  parseOnnxPocInspection,
} from './pipeline.ts';

test('requires the three ORT sessions and CLIP tokenizer files', () => {
  assert.deepEqual(
    [...ONNX_POC_REQUIRED_FILES],
    [
      'text_encoder/model.ort',
      'unet/model.ort',
      'vae_decoder/model.ort',
      'tokenizer/vocab.json',
      'tokenizer/merges.txt',
      'tokenizer/tokenizer_config.json',
    ],
  );
});

test('parses a successful session inspection', () => {
  const inspection = parseOnnxPocInspection({
    ok: true,
    rootPath: '/data/poc-chilloutmix',
    sessions: [
      {
        role: 'unet',
        relativePath: 'unet/model.ort',
        inputs: [{ name: 'sample', type: 'float32', shape: [1, 4, 32, 32] }],
        outputs: [{ name: 'out_sample', type: 'float32', shape: [1, 4, 32, 32] }],
      },
    ],
  });
  assert.equal(inspection.ok, true);
  if (!inspection.ok) return;
  assert.equal(inspection.sessions[0]?.inputs[0]?.name, 'sample');
});

test('accepts only 256 and 512 ONNX sizes', () => {
  assert.equal(isOnnxPocSize(256), true);
  assert.equal(isOnnxPocSize(512), true);
  assert.equal(isOnnxPocSize(768), false);
});

test('accepts only cpu, xnnpack, and nnapi ONNX backends', () => {
  assert.equal(isOnnxPocBackend('cpu'), true);
  assert.equal(isOnnxPocBackend('xnnpack'), true);
  assert.equal(isOnnxPocBackend('nnapi'), true);
  assert.equal(isOnnxPocBackend('vulkan'), false);
  assert.equal(isOnnxPocBackend('qnn'), false);
});

test('uses a photorealistic Chilloutmix prompt of a cat climbing a tree', () => {
  assert.match(ONNX_POC_PROMPT, /photorealistic/);
  assert.match(ONNX_POC_PROMPT, /cat climbing/);
});

test('parses a successful ONNX generation path', () => {
  const result = parseOnnxPocGeneration({
    ok: true,
    outputPath: '/data/poc-onnx-output.png',
    width: 256,
    height: 256,
    steps: 20,
    elapsedMs: 12000,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.width, 256);
  assert.equal(result.outputPath, '/data/poc-onnx-output.png');
});

test('keeps missing files when the pipeline is incomplete', () => {
  const inspection = parseOnnxPocInspection({
    ok: false,
    rootPath: '/data/poc-chilloutmix',
    missing: ['unet/model.ort'],
  });
  assert.equal(inspection.ok, false);
  if (inspection.ok) return;
  assert.deepEqual(inspection.missing, ['unet/model.ort']);
});
