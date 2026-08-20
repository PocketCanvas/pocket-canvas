import assert from 'node:assert/strict';
import test from 'node:test';

import { formatElapsedTime, generationProgressDetail } from './generation-progress.ts';

test('formats elapsed generation time as minutes and seconds', () => {
  assert.equal(formatElapsedTime(0), '00:00');
  assert.equal(formatElapsedTime(37), '00:37');
  assert.equal(formatElapsedTime(125), '02:05');
});

test('shows only elapsed time outside the sampling stage', () => {
  assert.equal(generationProgressDetail({ stage: 'loading' }, 12), '00:12');
  assert.equal(generationProgressDetail({ stage: 'encoding' }, 37), '00:37');
  assert.equal(generationProgressDetail({ stage: 'decoding' }, 71), '01:11');
});

test('shows sampling steps together with elapsed time', () => {
  assert.equal(
    generationProgressDetail({ stage: 'sampling', step: 2, steps: 4 }, 37),
    'Steps 2/4 · 00:37',
  );
});
