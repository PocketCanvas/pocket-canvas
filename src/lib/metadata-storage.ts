import { openDatabaseAsync } from 'expo-sqlite';

import { createMetadataDatabase, type MetadataDatabase } from './metadata-database';

let opening: Promise<MetadataDatabase> | undefined;

export function getMetadataDatabase(): Promise<MetadataDatabase> {
  opening ??= openDatabaseAsync('pocket-canvas.db').then(async (connection) => {
    const database = createMetadataDatabase(connection);
    try {
      await database.initialize();
      return database;
    } catch (error) {
      await connection.closeAsync();
      throw error;
    }
  }).catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}
