import { openDB } from 'idb';

const DB_NAME = 'PromptGalleryDB';
const STORE_NAME = 'pendingActions';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const savePendingAction = async (key: string, data: any) => {
  const db = await initDB();
  await db.put(STORE_NAME, data, key);
};

export const getPendingAction = async (key: string) => {
  const db = await initDB();
  return await db.get(STORE_NAME, key);
};

export const deletePendingAction = async (key: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, key);
};
