import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSourceUrl = new URL(
  '../../stable-diffusion/android/src/main/java/expo/modules/stablediffusion/StableDiffusionModule.kt',
  import.meta.url,
);

test('runs long native operations outside the shared Expo Modules queue', async () => {
  const source = await readFile(moduleSourceUrl, 'utf8');

  assert.match(source, /private val nativeOperationQueue = CoroutineScope/);
  assert.equal(source.match(/\.runOnQueue\(nativeOperationQueue\)/g)?.length, 2);
});
