import assert from 'node:assert/strict';
import test from 'node:test';

import { useOperationStore } from './use-operation-store.ts';

test('allows only one heavy operation to start at a time', () => {
  useOperationStore.setState({ activeOperation: null });

  const first = useOperationStore.getState().tryStartOperation({
    kind: 'generation',
    label: 'generation',
  });
  const second = useOperationStore.getState().tryStartOperation({
    kind: 'quantization',
    label: 'quantization',
  });

  assert.ok(first);
  assert.equal(second, null);
  assert.equal(useOperationStore.getState().activeOperation?.id, first.id);
});

test('only the owner token can finish the active operation', () => {
  useOperationStore.setState({ activeOperation: null });
  const operation = useOperationStore.getState().tryStartOperation({
    kind: 'modelImport',
    label: 'model import',
  });
  assert.ok(operation);

  useOperationStore.getState().finishOperation('stale-operation');
  assert.equal(useOperationStore.getState().activeOperation?.id, operation.id);

  useOperationStore.getState().finishOperation(operation.id);
  assert.equal(useOperationStore.getState().activeOperation, null);
});
