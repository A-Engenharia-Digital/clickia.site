import { openDB } from 'idb';
import { PhotoData } from '../types';

const DB_NAME = 'photos-cache-db';
const STORE_NAME = 'photos';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface CacheEntry {
  data: PhotoData[];
  timestamp: number;
}

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME);
  },
});

export const getCachedPhotos = async (page: number, pageSize: number): Promise<PhotoData[] | null> => {
  const key = `photos_page_${page}_size_${pageSize}`;
  try {
    const db = await dbPromise;
    const entry = await db.get(STORE_NAME, key) as CacheEntry | undefined;

    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL) {
      await db.delete(STORE_NAME, key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

export const setCachedPhotos = async (page: number, pageSize: number, data: PhotoData[]): Promise<void> => {
  const key = `photos_page_${page}_size_${pageSize}`;
  try {
    const db = await dbPromise;
    await db.put(STORE_NAME, {
      data,
      timestamp: Date.now()
    }, key);
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
};

export const clearPhotosCache = async (): Promise<void> => {
  try {
    const db = await dbPromise;
    await db.clear(STORE_NAME);
    console.log('Cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
