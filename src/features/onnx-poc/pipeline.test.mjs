import assert from 'node:assert/strict';
import test from 'node:test';

import { ONNX_POC_REQUIRED_FILES, parseOnnxPocInspection } from './pipeline.ts';

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
