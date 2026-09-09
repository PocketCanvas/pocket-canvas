import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDebugCrashLog } from './debug-log.ts';

const report = {
  schemaVersion: 3,
  kind: 'generation_crash',
  title: 'native SIGSEGV at ggml_backend_buft_alloc_buffer',
  breadcrumb: {
    schemaVersion: 3,
    kind: 'breadcrumb',
    status: 'running',
    stage: 'encoding',
    family: 'sd1',
  },
  device: { model: 'SM-G986N' },
  exit: { reason: 'crash_native', status: 11 },
  stack: { topSymbol: 'ggml_backend_buft_alloc_buffer', frames: [] },
};

test('shows a completed crash report title for the settings debug panel', () => {
  const parsed = parseDebugCrashLog(JSON.stringify(report));
  assert.equal(parsed?.source, 'report');
  assert.equal(parsed?.title, 'native SIGSEGV at ggml_backend_buft_alloc_buffer');
  assert.match(parsed?.detail ?? '', /"kind": "generation_crash"/);
});

test('labels an unfinished breadcrumb so it is not mistaken for a full report', () => {
  const parsed = parseDebugCrashLog(
    JSON.stringify({
      schemaVersion: 3,
      kind: 'breadcrumb',
      status: 'running',
      stage: 'encoding',
      loraCount: 0,
    }),
  );
  assert.equal(parsed?.source, 'breadcrumb');
  assert.equal(parsed?.title, '미완성 breadcrumb · encoding');
});
