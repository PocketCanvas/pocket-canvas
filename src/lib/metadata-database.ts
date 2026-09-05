import type { SQLiteDatabase } from 'expo-sqlite';

import { createAsyncOperationQueue } from './async-operation-queue.ts';
import type { StoredModel } from './model-files';
import type { StoredImageMetadata } from './image-metadata';

type Connection = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'>;
type Database = Connection & {
  withExclusiveTransactionAsync(task: (transaction: Connection) => Promise<void>): Promise<void>;
};
type ImageRow = { id: string; favorite: number; metadata: string };

function readImage(row: ImageRow): StoredImageMetadata {
  return { ...JSON.parse(row.metadata), id: row.id, favorite: Boolean(row.favorite) };
}

// Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
// Only short database commits enter this queue; model copying and inference stay outside it.
export function createMetadataDatabase(db: Database) {
  const enqueue = createAsyncOperationQueue();

  async function transaction<T>(task: (connection: Connection) => Promise<T>): Promise<T> {
    return enqueue(async () => {
      let result!: T;
      await db.withExclusiveTransactionAsync(async (connection) => {
        result = await task(connection);
      });
      return result;
    });
  }

  const insertModel = (connection: Connection, model: StoredModel) =>
    connection.runAsync(
      'INSERT INTO models (id, file_name, metadata) VALUES (?, ?, ?)',
      model.id, model.storedFileName, JSON.stringify(model),
    );
  const insertImage = (connection: Connection, image: StoredImageMetadata) =>
    connection.runAsync(
      `INSERT INTO images (id, file_name, created_at, favorite, metadata) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(file_name) DO UPDATE SET
         metadata = excluded.metadata,
         created_at = excluded.created_at
       WHERE json_extract(excluded.metadata, '$.metadataStatus') = 'complete'`,
      image.id, image.fileName, image.createdAt, Number(image.favorite), JSON.stringify(image),
    );

  return {
    async initialize() {
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
      await transaction(async (connection) => {
        const version = await connection.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if ((version?.user_version ?? 0) > 1) throw new Error('더 새로운 앱에서 만든 데이터베이스입니다.');
        await connection.execAsync(`
          DROP TABLE IF EXISTS storage_migrations;
          CREATE TABLE IF NOT EXISTS models (
            id TEXT PRIMARY KEY NOT NULL,
            file_name TEXT UNIQUE NOT NULL,
            metadata TEXT NOT NULL CHECK (json_valid(metadata))
          );
          CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY NOT NULL,
            file_name TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            favorite INTEGER NOT NULL CHECK (favorite IN (0, 1)),
            metadata TEXT NOT NULL CHECK (json_valid(metadata))
          );
          CREATE INDEX IF NOT EXISTS images_created_at ON images(created_at DESC);
          CREATE INDEX IF NOT EXISTS images_favorite_created_at ON images(favorite, created_at DESC);
          PRAGMA user_version = 1;
        `);
      });
    },
    async listModels(): Promise<StoredModel[]> {
      const rows = await db.getAllAsync<{ metadata: string }>('SELECT metadata FROM models ORDER BY rowid');
      return rows.map(({ metadata }) => JSON.parse(metadata));
    },
    addModel: (model: StoredModel) => transaction((connection) => insertModel(connection, model)),
    updateModel: (id: string, changes: Pick<StoredModel, 'alias' | 'kind' | 'description'>) =>
      transaction(async (connection) => {
        const result = await connection.runAsync(
          `UPDATE models SET metadata = json_set(metadata, '$.alias', ?, '$.kind', ?, '$.description', ?) WHERE id = ?`,
          changes.alias, changes.kind, changes.description, id,
        );
        if (!result.changes) throw new Error('모델을 찾을 수 없습니다.');
      }),
    deleteModel: (id: string, deleteFile: (fileName: string) => void) =>
      transaction(async (connection) => {
        const row = await connection.getFirstAsync<{ file_name: string }>('SELECT file_name FROM models WHERE id = ?', id);
        if (!row) throw new Error('모델을 찾을 수 없습니다.');
        await connection.runAsync('DELETE FROM models WHERE id = ?', id);
        deleteFile(row.file_name);
      }),
    async listImages(): Promise<StoredImageMetadata[]> {
      const rows = await db.getAllAsync<ImageRow>(
        'SELECT id, favorite, metadata FROM images ORDER BY created_at DESC, id DESC',
      );
      return rows.map(readImage);
    },
    saveImage: (image: StoredImageMetadata) => transaction((connection) => insertImage(connection, image)),
    recoverImage: (image: StoredImageMetadata, fileExists: () => boolean) =>
      transaction(async (connection) => {
        // A delete may have completed since the directory scan took its snapshot.
        if (!fileExists()) return null;
        await insertImage(connection, image);
        const row = await connection.getFirstAsync<ImageRow>(
          'SELECT id, favorite, metadata FROM images WHERE file_name = ?', image.fileName,
        );
        return row ? readImage(row) : null;
      }),
    toggleFavorite: (id: string) => transaction(async (connection) => {
      const row = await connection.getFirstAsync<ImageRow>(
        'UPDATE images SET favorite = 1 - favorite WHERE id = ? RETURNING id, favorite, metadata', id,
      );
      if (!row) throw new Error('이미지를 찾을 수 없습니다.');
      return readImage(row);
    }),
    deleteImage: (id: string, deleteFile: (fileName: string) => void) =>
      transaction(async (connection) => {
        const row = await connection.getFirstAsync<{ file_name: string }>('SELECT file_name FROM images WHERE id = ?', id);
        if (!row) throw new Error('삭제할 이미지를 찾을 수 없습니다.');
        await connection.runAsync('DELETE FROM images WHERE id = ?', id);
        deleteFile(row.file_name);
      }),
  };
}

export type MetadataDatabase = ReturnType<typeof createMetadataDatabase>;
