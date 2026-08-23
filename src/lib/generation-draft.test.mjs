import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialGenerationDraft, generationDraftReducer } from './generation-draft.ts';

function model(id, kind = 'model') {
  return {
    id,
    fileName: `${id}.safetensors`,
    storedFileName: `${id}.safetensors`,
    alias: id,
    kind,
    detectedKind: kind,
    format: 'safetensors',
    sizeBytes: 1,
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

test('disabling fixed seed restores random seed semantics', () => {
  const fixed = generationDraftReducer(createInitialGenerationDraft(), {
    type: 'seedChanged',
    value: 42,
  });

  const random = generationDraftReducer(fixed, {
    type: 'fixedSeedToggled',
    fixed: false,
  });

  assert.deepEqual(random.seed, { fixed: false, value: -1 });
});

test('changing a seed preserves the current fixed mode', () => {
  const next = generationDraftReducer(createInitialGenerationDraft(), {
    type: 'seedChanged',
    value: 1234,
  });

  assert.deepEqual(next.seed, { fixed: false, value: 1234 });
});

test('reconciles every selected resource against the refreshed model catalog', () => {
  const oldModel = model('model');
  const oldTaesd = model('taesd', 'unknown');
  const keptLora = model('kept-lora', 'lora');
  const removedLora = model('removed-lora', 'lora');
  const refreshedModel = { ...oldModel, alias: 'refreshed model' };
  const refreshedLora = { ...keptLora, alias: 'refreshed lora' };

  const selected = {
    ...createInitialGenerationDraft(),
    resources: {
      model: oldModel,
      taesd: oldTaesd,
      loras: [
        { model: keptLora, weight: 0.8 },
        { model: removedLora, weight: 1.2 },
      ],
    },
  };

  const reconciled = generationDraftReducer(selected, {
    type: 'resourcesReconciled',
    availableModels: [refreshedModel, refreshedLora],
  });

  assert.equal(reconciled.resources.model, refreshedModel);
  assert.equal(reconciled.resources.taesd, null);
  assert.deepEqual(reconciled.resources.loras, [{ model: refreshedLora, weight: 0.8 }]);
});
