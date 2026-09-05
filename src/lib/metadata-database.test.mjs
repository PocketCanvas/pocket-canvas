import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createMetadataDatabase } from './metadata-database.ts';
import { createImageMetadata } from './image-metadata.ts';

async function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const db = adapt(sqlite);
  await db.initialize();
  return db;
}

function adapt(sqlite) {
  const connection = {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, ...params) { return sqlite.prepare(sql).run(...params); },
    async getFirstAsync(sql, ...params) { return sqlite.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, ...params) { return sqlite.prepare(sql).all(...params); },
    async withExclusiveTransactionAsync(task) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await task(connection); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return createMetadataDatabase(connection);
}

const model = {
  id: 'm1', fileName: 'original.gguf', storedFileName: 'm1.gguf', alias: 'Model',
  kind: 'model', detectedKind: 'model', format: 'gguf', sizeBytes: 123,
  description: 'description', createdAt: '2026-09-05T00:00:00.000Z',
};
const image = {
  id: 'i1', fileName: 'image.png', metadataStatus: 'missing', favorite: false,
  createdAt: '2026-09-05T00:00:00.000Z',
};
const completeImage = createImageMetadata({
  prompt: 'A cat in space', negativePrompt: 'blurry',
  model: { id: 'm1', name: 'Model', storedFileName: 'm1.gguf' },
  decoder: { type: 'taesd', model: { id: 't1', name: 'TAESD', storedFileName: 't1.safetensors' } },
  loras: [{ id: 'l1', name: 'LCM', storedFileName: 'l1.safetensors', weight: 0.8 }],
  width: 512, height: 512, samplingPreset: 'lcm', steps: 4, cfgScale: 1, seed: 42,
  upscaler: { type: 'latent_bicubic', scale: 2, steps: 4, denoisingStrength: 0.7 },
}, new Date(image.createdAt), 'complete-id');

test('updates only the selected model and preserves literal SQL-like text', async (t) => {
  const db = await setup(t);
  await db.addModel(model);
  const other = { ...model, id: 'm2', storedFileName: 'm2.gguf' };
  await db.addModel(other);
  const changes = { alias: "O'Brien'); DROP TABLE models;--", kind: 'lora', description: 'new' };
  await db.updateModel(model.id, changes);
  assert.deepEqual(await db.listModels(), [{ ...model, ...changes }, other]);
});

test('file deletion failure rolls back only that deletion', async (t) => {
  const db = await setup(t);
  await db.addModel(model);
  await assert.rejects(db.deleteModel(model.id, () => { throw new Error('disk failure'); }));
  assert.deepEqual(await db.listModels(), [model]);
  await db.saveImage(image);
  await assert.rejects(db.deleteImage(image.id, () => { throw new Error('disk failure'); }));
  assert.deepEqual(await db.listImages(), [image]);
});

test('concurrent favorites are serialized without losing toggles', async (t) => {
  const db = await setup(t);
  await db.saveImage(image);
  await Promise.all(Array.from({ length: 5 }, () => db.toggleFavorite(image.id)));
  assert.equal((await db.listImages())[0].favorite, true);
});

test('recovery cannot downgrade complete metadata or reset favorites and identity', async (t) => {
  const db = await setup(t);
  await db.saveImage(image);
  await db.toggleFavorite(image.id);
  const completed = { ...completeImage, fileName: image.fileName, prompt: 'saved later' };
  await db.saveImage(completed);
  await db.saveImage(image);
  const stored = (await db.listImages())[0];
  assert.equal(stored.id, image.id);
  assert.equal(stored.favorite, true);
  assert.equal(stored.prompt, 'saved later');
  assert.equal(stored.metadataStatus, 'complete');
});

test('recovery checks file existence after a queued deletion and does not resurrect it', async (t) => {
  const db = await setup(t);
  await db.saveImage(image);
  let exists = true;
  const deletion = db.deleteImage(image.id, () => { exists = false; });
  const recovery = db.recoverImage(image, () => exists);
  await deletion;
  assert.equal(await recovery, null);
  assert.deepEqual(await db.listImages(), []);
});

test('recovery returns the canonical record if a complete save wins the race', async (t) => {
  const db = await setup(t);
  const complete = { ...completeImage, fileName: image.fileName };
  const saving = db.saveImage(complete);
  const recovering = db.recoverImage(image, () => true);
  await saving;
  assert.deepEqual(await recovering, complete);
});

test('records survive closing and reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pocket-canvas-sqlite-test-'));
  const path = join(directory, 'metadata.db');
  let sqlite;
  try {
    sqlite = new DatabaseSync(path);
    const first = adapt(sqlite);
    await first.initialize();
    await first.addModel(model);
    await first.saveImage(completeImage);
    await first.toggleFavorite(completeImage.id);
    sqlite.close();
    sqlite = new DatabaseSync(path);
    const reopened = adapt(sqlite);
    await reopened.initialize();
    assert.deepEqual(await reopened.listModels(), [model]);
    assert.deepEqual(await reopened.listImages(), [{ ...completeImage, favorite: true }]);
  } finally {
    sqlite?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('drops leftover JSON migration markers without touching records', async (t) => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`
    PRAGMA user_version = 1;
    CREATE TABLE models (
      id TEXT PRIMARY KEY NOT NULL,
      file_name TEXT UNIQUE NOT NULL,
      metadata TEXT NOT NULL
    );
    CREATE TABLE storage_migrations (name TEXT PRIMARY KEY NOT NULL);
    INSERT INTO models (id, file_name, metadata) VALUES ('m1', 'm1.gguf', '${JSON.stringify(model)}');
    INSERT INTO storage_migrations (name) VALUES ('models-json-v1');
  `);
  const db = adapt(sqlite);
  await db.initialize();
  assert.equal(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'storage_migrations'").get(),
    undefined,
  );
  assert.deepEqual(await db.listModels(), [model]);
});

test('refuses a newer schema without resetting its version or data', async (t) => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA user_version = 2');
  await assert.rejects(adapt(sqlite).initialize(), /새로운 앱/);
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 2);
});
