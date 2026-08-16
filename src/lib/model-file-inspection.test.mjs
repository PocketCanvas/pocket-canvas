import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';

import { inspectModelBytes, supportedModelExtension } from './model-file-inspection.ts';

const encoder = new TextEncoder();

function safetensors(header, dataSize = 128) {
  const json = encoder.encode(JSON.stringify(header));
  const bytes = new Uint8Array(8 + json.length + dataSize);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(json.length), true);
  bytes.set(json, 8);
  return bytes;
}

test('classifies paired LoRA tensors', () => {
  const result = inspectModelBytes(
    safetensors({
      'layer.lora_down.weight': { dtype: 'F16', shape: [4, 8], data_offsets: [0, 64] },
      'layer.lora_up.weight': { dtype: 'F16', shape: [8, 4], data_offsets: [64, 128] },
    }),
  );

  assert.equal(result.format, 'safetensors');
  assert.equal(result.kind, 'lora');
});

test('classifies a full diffusion checkpoint', () => {
  const result = inspectModelBytes(
    safetensors({
      'model.diffusion_model.input_blocks.0.weight': {
        dtype: 'F16',
        shape: [4],
        data_offsets: [0, 8],
      },
    }),
  );

  assert.equal(result.kind, 'model');
});

test('parses a GGUF tensor directory without reading tensor data', () => {
  const name = encoder.encode('model.diffusion_model.weight');
  const bytes = Buffer.concat([
    Buffer.from('GGUF'),
    uint32(3),
    uint64(1),
    uint64(0),
    uint64(name.length),
    name,
    uint32(1),
    uint64(4),
    uint32(0),
    uint64(0),
  ]);

  const result = inspectModelBytes(bytes);
  assert.equal(result.format, 'gguf');
  assert.equal(result.kind, 'model');
});

test('rejects a PNG even when its filename could be disguised', () => {
  assert.throws(
    () => inspectModelBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])),
    /지원하지 않는 파일 형식/,
  );
});

test('detects supported extensions from the display name instead of a content URI', () => {
  assert.equal(supportedModelExtension('v1-5-pruned-emaonly-fp16.safetensors'), '.safetensors');
  assert.equal(supportedModelExtension('MODEL.GGUF'), '.gguf');
  assert.equal(supportedModelExtension('preview.png'), null);
});

function uint32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function uint64(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
}
