import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../../', import.meta.url);

test('creates the Android project and Vulkan workaround inside the Docker build', async () => {
  const dockerfile = await readFile(new URL('Dockerfile.android', repositoryRoot), 'utf8');
  const dockerignore = await readFile(new URL('.dockerignore', repositoryRoot), 'utf8');

  assert.match(dockerignore, /^\/android\/?$/m);
  assert.match(dockerignore, /^\*\.keystore$/m);
  assert.match(dockerfile, /npm ci[\s\S]*npx expo prebuild --platform android --no-install/);
  assert.match(
    dockerfile,
    /cp docs\/CMakeLists\.txt stable-diffusion\/cpp\/stable-diffusion\.cpp\/ggml\/src\/ggml-vulkan\/CMakeLists\.txt/,
  );
  assert.match(dockerfile, /npx expo prebuild[\s\S]*\.\/gradlew :app:assembleRelease/);
});
