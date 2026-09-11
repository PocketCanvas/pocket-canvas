import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bridgePath = new URL(
  '../../../stable-diffusion/cpp/StableDiffusionBridge.cpp',
  import.meta.url,
);
const diagnosticsPath = new URL(
  '../../../stable-diffusion/cpp/GenerationDiagnostics.cpp',
  import.meta.url,
);
const callbacksPath = new URL('../../../stable-diffusion/cpp/NativeCallbacks.cpp', import.meta.url);
const collectorPath = new URL(
  '../../../stable-diffusion/cpp/NativeLogCollector.cpp',
  import.meta.url,
);

test('settings CPU selects ggml CPU compute and params backends', async () => {
  const bridge = await readFile(bridgePath, 'utf8');
  const diagnostics = await readFile(diagnosticsPath, 'utf8');

  assert.match(bridge, /force_cpu_backend = std::strcmp\(inference_backend, "cpu"\) == 0/);
  assert.match(bridge, /applied_compute_backend = force_cpu_backend \? "cpu" : "vulkan"/);
  assert.match(
    bridge,
    /applied_params_backend = force_cpu_backend \? "\*=cpu" : memory_policy\.params_backend/,
  );
  assert.match(bridge, /ctx_params\.backend = applied_compute_backend/);
  assert.match(bridge, /ctx_params\.params_backend = applied_params_backend/);
  assert.doesNotMatch(bridge, /ctx_params\.backend = "vulkan"/);
  assert.match(diagnostics, /json_quote\(record\.compute_backend\)/);
});

test('native logcat omits prompts, paths, seed, and model variant identity', async () => {
  const bridge = await readFile(bridgePath, 'utf8');

  assert.doesNotMatch(bridge, /\[request\] model=%s/);
  assert.doesNotMatch(bridge, /prompt_bytes=/);
  assert.doesNotMatch(bridge, /negative_bytes=/);
  assert.doesNotMatch(bridge, /seed=%/);
  assert.doesNotMatch(bridge, /variant=%s/);
  assert.doesNotMatch(bridge, /output=%s/);
  assert.doesNotMatch(bridge, /\[quantize\] input=%s output=%s/);
});

test('breadcrumb logcat retains non-identifying crash execution context', async () => {
  const diagnostics = await readFile(diagnosticsPath, 'utf8');

  assert.match(diagnostics, /\[breadcrumb\] stage=%s vulkan=%s family=%s lora=%d policy=%s/);
});

test('upstream logcat and native tail share redaction for identity-bearing text', async () => {
  const callbacks = await readFile(callbacksPath, 'utf8');
  const collector = await readFile(collectorPath, 'utf8');

  assert.match(callbacks, /sanitize_native_log\(text\)/);
  assert.match(collector, /prompt:/);
  assert.match(collector, /negative_prompt:/);
  assert.match(collector, /split prompt/);
  assert.match(collector, /model_path:/);
  assert.match(collector, /file:\/\//);
  assert.match(collector, /content:\/\//);
  assert.match(collector, /\/data\/user\//);
});
