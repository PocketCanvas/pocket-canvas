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

test('applies the verified SDXL Turbo Q4 768 VAE policy in the native bridge', async () => {
  const source = await readFile(bridgeSourceUrl, 'utf8');

  assert.match(source, /vae_memory_profile.*sdxl-turbo-q4/);
  assert.match(source, /img_params\.vae_tiling_params\.enabled\s*=\s*true;/);
  assert.match(source, /img_params\.vae_tiling_params\.tile_size_x\s*=\s*48;/);
  assert.match(source, /img_params\.vae_tiling_params\.tile_size_y\s*=\s*48;/);
  assert.match(source, /vae_profile=%s vae_policy=%s vae_tiling=%s/);
});
