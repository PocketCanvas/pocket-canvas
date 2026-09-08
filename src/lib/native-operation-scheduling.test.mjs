import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const kotlinSourceDirectory = new URL(
  '../../stable-diffusion/android/src/main/java/expo/modules/stablediffusion/',
  import.meta.url,
);
const cppSourceDirectory = new URL('../../stable-diffusion/cpp/', import.meta.url);

async function readSources(directory, extension) {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort();
  return (await Promise.all(names.map((name) => readFile(new URL(name, directory), 'utf8')))).join(
    '\n',
  );
}

test('runs long native operations outside the shared Expo Modules queue', async () => {
  const source = await readSources(kotlinSourceDirectory, '.kt');

  assert.match(source, /private val nativeOperationQueue = CoroutineScope/);
  assert.equal(source.match(/\.runOnQueue\(nativeOperationQueue\)/g)?.length, 2);
});

test('resolves the verified SDXL Turbo Q4 768 VAE policy in the native bridge', async () => {
  const source = await readSources(cppSourceDirectory, '.cpp');

  assert.match(source, /resolve_memory_policy/);
  assert.match(source, /sdxl-turbo-q4-768-safe-v1/);
  assert.match(source, /img_params\.vae_tiling_params\.enabled\s*=\s*true;/);
  assert.match(source, /policy\.vae_tile_x\s*=\s*48;/);
  assert.match(source, /policy\.vae_tile_y\s*=\s*48;/);
  assert.match(source, /memory_source=%s memory_policy=%s/);
});

test('resolves verified and conservative CPU residency without rejecting unknown models', async () => {
  const source = await readSources(cppSourceDirectory, '.cpp');

  assert.match(source, /sdxl-turbo-float-512-safe-v1/);
  assert.match(source, /conservative_residency_threshold/);
  assert.match(source, /policy\.params_backend\s*=\s*"\*=cpu";/);
  assert.match(source, /ctx_params\.params_backend\s*=\s*memory_policy\.params_backend;/);
  assert.doesNotMatch(source, /Rejected|unsupported-unverified-memory-plan/);
});

test('writes durable generation breadcrumbs and omits prompt or model paths', async () => {
  const source = await readSources(cppSourceDirectory, '.cpp');

  assert.match(source, /write_generation_diagnostic/);
  assert.match(source, /fsync\(fileno\(file\)\)/);
  assert.match(source, /query_vulkan_identity/);
  assert.match(source, /kind\\":\\"breadcrumb/);
  assert.match(source, /lora_apply/);
  assert.match(source, /jDiagnosticPath/);
  assert.doesNotMatch(source, /json \+= json_quote\(prompt\)/);
  assert.doesNotMatch(source, /json \+= json_quote\(model_path\)/);
  assert.doesNotMatch(source, /json \+= json_quote\(output_path\)/);
});

test('assembles a crash report outside the native operation queue', async () => {
  const source = await readSources(kotlinSourceDirectory, '.kt');
  const consumeBlock = source.match(
    /AsyncFunction\("consumeInterruptedGeneration"\)[\s\S]*?AsyncFunction\("quantizeModel"\)/,
  )?.[0];

  assert.ok(consumeBlock);
  assert.match(source, /getHistoricalProcessExitReasons/);
  assert.match(source, /traceInputStream/);
  assert.match(source, /TombstoneTraceParser/);
  assert.match(source, /last-crash.json/);
  assert.match(source, /generation_crash/);
  assert.match(source, /\[crash\]/);
  assert.match(source, /FORBIDDEN_DIAGNOSTIC_KEYS/);
  assert.doesNotMatch(consumeBlock, /runOnQueue/);
});
