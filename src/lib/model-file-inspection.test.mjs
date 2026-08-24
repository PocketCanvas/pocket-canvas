import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';

import {
  describeModel,
  inspectModelBytes,
  inspectQuantizationAvailability,
  supportedModelExtension,
} from './model-file-inspection.ts';

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

test('allows quantization for a floating-point SafeTensors model', () => {
  const inspection = inspectModelBytes(
    safetensors({
      'model.diffusion_model.input_blocks.0.weight': {
        dtype: 'F16',
        shape: [4],
        data_offsets: [0, 8],
      },
    }),
  );

  assert.deepEqual(inspectQuantizationAvailability(inspection), {
    type: 'available',
    sourcePrecision: 'f16',
  });
});

test('detects an imported quantized GGUF from its tensor storage types', () => {
  const inspection = inspectModelBytes(
    gguf([
      { name: 'model.diffusion_model.weight', type: 12 },
      { name: 'model.diffusion_model.bias', type: 0 },
    ]),
  );

  assert.deepEqual(inspectQuantizationAvailability(inspection), {
    type: 'alreadyQuantized',
    primaryType: 'q4_K',
  });
});

test('identifies SD 1.x from its UNet and 768-wide token embedding', () => {
  const inspection = inspectModelBytes(
    safetensors(
      {
        'model.diffusion_model.input_blocks.0.0.weight': {
          dtype: 'F16',
          shape: [320, 4, 3, 3],
          data_offsets: [0, 256],
        },
        'cond_stage_model.transformer.text_model.embeddings.token_embedding.weight': {
          dtype: 'F16',
          shape: [4, 768],
          data_offsets: [256, 512],
        },
      },
      512,
    ),
  );

  assert.equal(inspection.family, 'sd1');
});

test('tracks component storage bytes without treating float auxiliaries as mixed Q4', () => {
  const inspection = inspectModelBytes(
    gguf([
      {
        name: 'model.diffusion_model.input_blocks.0.0.weight',
        type: 12,
        shape: [256],
      },
      { name: 'model.diffusion_model.input_blocks.0.0.bias', type: 0, shape: [4] },
      { name: 'first_stage_model.decoder.conv.weight', type: 1, shape: [8] },
    ]),
  );

  assert.equal(inspection.storage.diffusion.dominantType, 'q4');
  assert.equal(inspection.storage.diffusion.estimatedBytes, 160);
  assert.equal(inspection.storage.vae.dominantType, 'f16');
  assert.equal(inspection.storage.vae.estimatedBytes, 16);
});

test('describes Turbo provenance separately from structural family and storage', () => {
  const inspection = inspectModelBytes(
    gguf([
      {
        name: 'model.diffusion_model.input_blocks.0.0.weight',
        type: 8,
        shape: [32],
      },
      { name: 'conditioner.embedders.1.model.text_projection', type: 0, shape: [4] },
    ]),
  );

  const descriptor = describeModel(inspection, {
    originalFileName: 'custom-sdxl-turbo-q8.gguf',
    alias: 'renamed model',
  });

  assert.deepEqual(descriptor.family, {
    value: 'sdxl',
    evidence: 'tensor-signature',
  });
  assert.deepEqual(descriptor.variant, {
    value: 'turbo',
    evidence: 'original-file-name',
  });
  assert.equal(descriptor.storage.diffusion.dominantType, 'q8');
});

test('rejects a GGUF with an unknown tensor storage type', () => {
  const inspection = inspectModelBytes(gguf([{ name: 'model.diffusion_model.weight', type: 99 }]));

  assert.deepEqual(inspectQuantizationAvailability(inspection), {
    type: 'unsupported',
    reason: '지원하지 않는 GGUF tensor 저장 타입이 포함되어 있습니다: 99',
  });
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

function gguf(tensors, metadata = {}) {
  const metadataEntries = Object.entries(metadata).flatMap(([key, value]) => {
    const encodedKey = encoder.encode(key);
    const encodedValue = encoder.encode(value);
    return [
      uint64(encodedKey.length),
      encodedKey,
      uint32(8),
      uint64(encodedValue.length),
      encodedValue,
    ];
  });
  const directory = tensors.flatMap(({ name, type, shape = [4] }) => {
    const encodedName = encoder.encode(name);
    return [
      uint64(encodedName.length),
      encodedName,
      uint32(shape.length),
      ...shape.map(uint64),
      uint32(type),
      uint64(0),
    ];
  });
  return Buffer.concat([
    Buffer.from('GGUF'),
    uint32(3),
    uint64(tensors.length),
    uint64(Object.keys(metadata).length),
    ...metadataEntries,
    ...directory,
  ]);
}
