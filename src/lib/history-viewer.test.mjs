import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createViewerItemsKey,
  findViewerIndex,
  selectAfterViewerDelete,
} from './history-viewer.ts';

const items = [{ id: 'first' }, { id: 'second' }, { id: 'third' }];

test('finds the selected image in the current filtered order', () => {
  assert.equal(findViewerIndex(items, 'second'), 1);
  assert.equal(findViewerIndex(items, 'missing'), 0);
});

test('keeps the same visual position after deleting the selected image', () => {
  assert.equal(selectAfterViewerDelete(items, 'second'), 'third');
});

test('falls back to the previous image when deleting the last image', () => {
  assert.equal(selectAfterViewerDelete(items, 'third'), 'second');
  assert.equal(selectAfterViewerDelete([{ id: 'only' }], 'only'), null);
});

test('changes the gallery identity only when its ordered item list changes', () => {
  assert.equal(createViewerItemsKey(items), 'first\u0000second\u0000third');
  assert.equal(createViewerItemsKey([...items]), createViewerItemsKey(items));
  assert.notEqual(createViewerItemsKey(items.slice(0, -1)), createViewerItemsKey(items));
  assert.notEqual(createViewerItemsKey(items.toReversed()), createViewerItemsKey(items));
});
