import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleGenerationCrashReport,
  buildGenerationCrashTitle,
  crashTopSymbol,
  diagnosticContainsForbiddenKeys,
  isGenerationCrashReport,
  parseGenerationCrashReport,
  selectCrashStackFrames,
} from './generation-diagnostics.ts';

const breadcrumb = {
  schemaVersion: 2,
  kind: 'breadcrumb',
  status: 'running',
  stage: 'lora_apply',
  width: 512,
  height: 512,
  steps: 4,
  preset: 'lcm',
  family: 'sd1',
  diffusionStorage: 'f32',
  loraCount: 1,
  vulkanApi: '1.1.128',
  vulkanDevice: 'Adreno (TM) 650',
  memoryPolicy: 'sd1-512-native-v1',
};

const tombstone = [
  '#00 pc 0000000000000000  <unknown>',
  '#01 pc 0000000006c279c8  /data/app/base.apk!libstable_diffusion_bridge.so',
  '#04 pc 0000000006d4e5d0  libstable_diffusion_bridge.so (ggml_backend_buft_alloc_buffer+180)',
  '#09 pc 000000000678c9dc  libstable_diffusion_bridge.so (LoraModel::load_from_file(int)+1512)',
  '#16 pc 00000000002b03a0  /apex/com.android.art/lib64/libart.so (art_quick_generic_jni_trampoline+144)',
];

test('builds a readable crash title from the native symbol and signal', () => {
  const frames = selectCrashStackFrames(tombstone);
  assert.equal(crashTopSymbol(frames), 'ggml_backend_buft_alloc_buffer');
  assert.equal(
    buildGenerationCrashTitle({
      reason: 'crash_native',
      status: 11,
      stage: 'lora_apply',
      topSymbol: 'ggml_backend_buft_alloc_buffer',
    }),
    'native SIGSEGV at ggml_backend_buft_alloc_buffer',
  );
});

test('assembles a privacy-safe generation crash report', () => {
  const report = assembleGenerationCrashReport({
    breadcrumb,
    device: { model: 'SM-G986N', sdk: 33, totalRamMb: 10601 },
    exit: { reason: 'crash_native', status: 11 },
    stackFrames: [
      {
        library: 'libstable_diffusion_bridge.so',
        pc: '0x7129992be0',
        relPc: '0x6d4e5d0',
        symbol: 'ggml_backend_buft_alloc_buffer',
        symbolOffset: 180,
        buildId: 'fac53140ad50e9dc',
      },
    ],
  });

  assert.equal(report?.kind, 'generation_crash');
  assert.equal(report?.title, 'native SIGSEGV at ggml_backend_buft_alloc_buffer');
  assert.equal(report?.breadcrumb.stage, 'lora_apply');
  assert.equal(report?.stack.topSymbol, 'ggml_backend_buft_alloc_buffer');
  assert.equal(parseGenerationCrashReport(report)?.title, report?.title);
  assert.equal(isGenerationCrashReport(report), true);
});

test('rejects prompt, path, alias, and seed fields', () => {
  const withPrompt = assembleGenerationCrashReport({
    breadcrumb: { ...breadcrumb, prompt: 'secret' },
    device: { model: 'SM-G986N' },
    exit: { reason: 'crash_native', status: 11 },
    stackFrames: [],
  });
  assert.equal(withPrompt, null);
  for (const key of ['prompt', 'modelPath', 'outputPath', 'alias', 'fileName', 'uri', 'seed']) {
    assert.deepEqual(diagnosticContainsForbiddenKeys({ ...breadcrumb, [key]: 'secret' }), [key]);
  }
});

test('names a low-memory kill without pretending it is a native symbol crash', () => {
  assert.equal(
    buildGenerationCrashTitle({
      reason: 'low_memory',
      stage: 'encoding',
      topSymbol: null,
    }),
    'process killed: low memory during encoding',
  );
});
