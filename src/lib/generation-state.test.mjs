import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInitialGenerationRunState,
  generationRunReducer,
  visibleGenerationImageUri,
} from './generation-state.ts';

test('starts generation while preserving the previous image', () => {
  const initial = createInitialGenerationRunState('file:///previous.png');

  const running = generationRunReducer(initial, { type: 'started' });

  assert.deepEqual(running, {
    status: 'running',
    previousImageUri: 'file:///previous.png',
    progress: { stage: 'loading' },
  });
});

test('accepts progress only while generation is running', () => {
  const idle = createInitialGenerationRunState();
  assert.equal(
    generationRunReducer(idle, {
      type: 'progressed',
      progress: { stage: 'sampling', step: 2, steps: 4 },
    }),
    idle,
  );

  const running = generationRunReducer(idle, { type: 'started' });
  assert.deepEqual(
    generationRunReducer(running, {
      type: 'progressed',
      progress: { stage: 'sampling', step: 2, steps: 4 },
    }),
    {
      ...running,
      progress: { stage: 'sampling', step: 2, steps: 4 },
    },
  );
});

test('represents metadata persistence failure as success with a warning', () => {
  const running = generationRunReducer(createInitialGenerationRunState(), { type: 'started' });

  const succeeded = generationRunReducer(running, {
    type: 'succeeded',
    imageUri: 'file:///generated.png',
    warning: '이미지는 저장했지만 생성 정보를 기록하지 못했습니다.',
  });

  assert.deepEqual(succeeded, {
    status: 'succeeded',
    imageUri: 'file:///generated.png',
    warning: '이미지는 저장했지만 생성 정보를 기록하지 못했습니다.',
  });
  assert.equal(visibleGenerationImageUri(succeeded), 'file:///generated.png');
});

test('preserves the previous image when generation fails', () => {
  const running = generationRunReducer(createInitialGenerationRunState('file:///previous.png'), {
    type: 'started',
  });

  const failed = generationRunReducer(running, {
    type: 'failed',
    error: '이미지를 생성하지 못했습니다.',
  });

  assert.deepEqual(failed, {
    status: 'failed',
    previousImageUri: 'file:///previous.png',
    error: '이미지를 생성하지 못했습니다.',
  });
  assert.equal(visibleGenerationImageUri(failed), 'file:///previous.png');
});
