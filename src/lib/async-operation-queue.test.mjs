import assert from 'node:assert/strict';
import test from 'node:test';

import { createAsyncOperationQueue } from './async-operation-queue.ts';

test('runs queued read-modify-write operations in order', async () => {
  const enqueue = createAsyncOperationQueue();
  const order = [];
  let releaseFirst;

  const first = enqueue(async () => {
    order.push('first:start');
    await new Promise((resolve) => {
      releaseFirst = resolve;
    });
    order.push('first:end');
  });
  const second = enqueue(async () => {
    order.push('second');
  });

  await Promise.resolve();
  assert.deepEqual(order, ['first:start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second']);
});

test('continues the queue after an operation fails', async () => {
  const enqueue = createAsyncOperationQueue();
  const failed = enqueue(async () => {
    throw new Error('expected failure');
  });
  const next = enqueue(async () => 'completed');

  await assert.rejects(failed, /expected failure/);
  assert.equal(await next, 'completed');
});
