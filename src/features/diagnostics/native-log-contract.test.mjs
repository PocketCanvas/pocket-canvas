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

  assert.match(
    diagnostics,
    /\[breadcrumb\] stage=%s backend=%s vulkan=%s family=%s lora=%d policy=%s/,
  );
});

test('Android OpenCL runtime forwards vendor libOpenCL.so instead of packaging Khronos ICD', async () => {
  const cmake = await readFile(
    new URL('../../../stable-diffusion/android/CMakeLists.txt', import.meta.url),
    'utf8',
  );
  const forward = await readFile(
    new URL('../../../stable-diffusion/cpp/OpenCLForward.cpp', import.meta.url),
    'utf8',
  );

  assert.match(cmake, /OpenCLForward\.cpp/);
  assert.doesNotMatch(cmake, /OpenCL-ICD-Loader/);
  assert.match(forward, /\/vendor\/lib64\/libOpenCL\.so/);
  assert.match(forward, /clGetPlatformIDs/);
});

test('generation backend is selected at runtime and OpenCL skips memory policy', async () => {
  const bridge = await readFile(bridgePath, 'utf8');
  const options = await readFile(
    new URL('../../../stable-diffusion/cpp/GenerationOptions.cpp', import.meta.url),
    'utf8',
  );

  assert.match(options, /resolve_compute_backend/);
  assert.match(bridge, /ctx_params\.backend = compute_backend/);
  assert.match(bridge, /ctx_params\.enable_mmap = true/);
  assert.doesNotMatch(bridge, /ctx_params\.backend = "vulkan"/);
  assert.match(bridge, /opencl_backend/);
  assert.match(bridge, /ResolvedMemoryPolicy\{\}/);
  assert.match(bridge, /resolve_memory_policy\(model_descriptor, memory_workload\)/);
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
