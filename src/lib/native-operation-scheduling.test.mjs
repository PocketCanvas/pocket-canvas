import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSourceUrl = new URL(
  '../../stable-diffusion/android/src/main/java/expo/modules/stablediffusion/StableDiffusionModule.kt',
  import.meta.url,
);
const bridgeSourceUrl = new URL(
  '../../stable-diffusion/cpp/StableDiffusionBridge.cpp',
  import.meta.url,
);

test('runs long native operations outside the shared Expo Modules queue', async () => {
  const source = await readFile(moduleSourceUrl, 'utf8');

  assert.match(source, /private val nativeOperationQueue = CoroutineScope/);
  assert.equal(source.match(/\.runOnQueue\(nativeOperationQueue\)/g)?.length, 2);
});

test('resolves the verified SDXL Turbo Q4 768 VAE policy in the native bridge', async () => {
  const source = await readFile(bridgeSourceUrl, 'utf8');

  assert.match(source, /resolve_memory_policy/);
  assert.match(source, /sdxl-turbo-q4-768-safe-v1/);
  assert.match(source, /img_params\.vae_tiling_params\.enabled\s*=\s*true;/);
  assert.match(source, /policy\.vae_tile_x\s*=\s*48;/);
  assert.match(source, /policy\.vae_tile_y\s*=\s*48;/);
  assert.match(source, /memory_source=%s memory_policy=%s/);
});

test('resolves verified and conservative CPU residency without rejecting unknown models', async () => {
  const source = await readFile(bridgeSourceUrl, 'utf8');

  assert.match(source, /sdxl-turbo-float-512-safe-v1/);
  assert.match(source, /conservative_residency_threshold/);
  assert.match(source, /policy\.params_backend\s*=\s*"\*=cpu";/);
  assert.match(source, /ctx_params\.params_backend\s*=\s*memory_policy\.params_backend;/);
  assert.doesNotMatch(source, /Rejected|unsupported-unverified-memory-plan/);
});
