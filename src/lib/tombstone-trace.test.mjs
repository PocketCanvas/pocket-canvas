import assert from 'node:assert/strict';
import test from 'node:test';

import {
  crashFrameTopSymbol,
  encodeLengthDelimited,
  encodeStringField,
  encodeVarintField,
  parseTombstoneTrace,
} from './tombstone-trace.ts';

function concat(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

test('parses a protobuf tombstone crashing-thread backtrace', () => {
  const frame = concat([
    encodeVarintField(1, 0x6d4e5d0),
    encodeVarintField(2, 0x7129992be0),
    encodeStringField(4, 'ggml_backend_buft_alloc_buffer'),
    encodeVarintField(5, 180),
    encodeStringField(6, '/data/app/base.apk!libstable_diffusion_bridge.so'),
    encodeStringField(8, 'fac53140ad50e9dc18083894fdaa1b8c216c310e'),
  ]);
  const signal = concat([
    encodeVarintField(1, 11),
    encodeStringField(2, 'SIGSEGV'),
    encodeVarintField(3, 1),
    encodeStringField(4, 'SEGV_MAPERR'),
    encodeVarintField(9, 0),
  ]);
  const thread = concat([encodeVarintField(1, 1483), encodeLengthDelimited(4, frame)]);
  const mapEntry = concat([encodeVarintField(1, 1483), encodeLengthDelimited(2, thread)]);
  const tombstone = concat([
    encodeVarintField(6, 1483),
    encodeLengthDelimited(10, signal),
    encodeLengthDelimited(16, mapEntry),
  ]);

  const parsed = parseTombstoneTrace(tombstone);
  assert.deepEqual(parsed.frames, [
    {
      library: 'libstable_diffusion_bridge.so',
      pc: '0x7129992be0',
      relPc: '0x6d4e5d0',
      symbol: 'ggml_backend_buft_alloc_buffer',
      symbolOffset: 180,
      buildId: 'fac53140ad50e9dc18083894fdaa1b8c216c310e',
    },
  ]);
  assert.deepEqual(parsed.signal, {
    number: 11,
    name: 'SIGSEGV',
    code: 1,
    codeName: 'SEGV_MAPERR',
    faultAddress: '0x0',
  });
  assert.equal(crashFrameTopSymbol(parsed.frames), 'ggml_backend_buft_alloc_buffer');
});

test('parses a text tombstone backtrace as a fallback', () => {
  const text = [
    '*** *** *** ***',
    'backtrace:',
    '#00 pc 0000000000000000  <unknown>',
    '#04 pc 0000000006d4e5d0  /data/app/base.apk!libstable_diffusion_bridge.so (ggml_backend_buft_alloc_buffer+180)',
  ].join('\n');

  const parsed = parseTombstoneTrace(new TextEncoder().encode(text));
  assert.equal(parsed.frames[1]?.symbol, 'ggml_backend_buft_alloc_buffer');
  assert.equal(parsed.frames[1]?.symbolOffset, 180);
  assert.equal(crashFrameTopSymbol(parsed.frames), 'ggml_backend_buft_alloc_buffer');
});
