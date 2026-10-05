/*
 * Intent: IndexedDB storage for settings, tasks, and form state (2026-10-05)
 * Original requirement: Migrate from localStorage to IndexedDB, preserve existing user data
 *
 * Architecture:
 * - DB: openai-image-webui (new, separate from existing imageCache DB)
 * - Stores: settings (singleton), tasks (keyPath "key", value-wrapped records,
 *   index on value.createdAt), kv (form drafts) — typed via StorageSchema
 * - Migration: one-time import from localStorage, delete old keys only after successful write
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, ImageTask } from '../types';

const DB_NAME = 'openai-image-webui';
const DB_VERSION = 1;

/** Known kv keys — extends as new form drafts / state entries are added. */
type KVKey = 'lastPrompt' | 'lastSize' | 'lastAdvancedJson' | 'lastBatchPrompts' | 'currentBatchId';

type KVValueMap = {
  lastPrompt: string;
  lastSize: string;
  lastAdvancedJson: string;
  lastBatchPrompts: string;
  currentBatchId: string;
};

/**
 * Extends idb's DBSchema so store/key/value types flow through every call —
 * without `extends DBSchema` idb degrades StoreValue to `any` and tsc proves
 * nothing about the storage API.
 */
interface StorageSchema extends DBSchema {
  settings: {
    key: 'default';
    value: { key: 'default'; value: AppSettings };
  };
  tasks: {
    key: string; // task.id
    value: { key: string; value: ImageTask };
    indexes: {
      createdAt: number; // index path: value.createdAt
    };
  };
  kv: {
    key: KVKey;
    value: { key: KVKey; value: KVValueMap[KVKey] };
  };
}

let dbPromise: Promise<IDBPDatabase<StorageSchema>> | null = null;

function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<StorageSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Settings store (singleton)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Tasks store (no 500-item limit anymore)
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'key' });
        taskStore.createIndex('createdAt', 'value.createdAt');
      }

      // KV store (form drafts, batch state)
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    },
  });

  return dbPromise;
}

// Settings
export async function getSettings(): Promise<AppSettings | null> {
  const db = await getDB();
  const record = await db.get('settings', 'default');
  return record?.value ?? null;
}

export async function setSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key: 'default', value: settings });
}

// Tasks (no limit, full history)
export async function getTasks(): Promise<ImageTask[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('tasks', 'createdAt');
  return records.map(r => r.value);
}

export async function addTask(task: ImageTask): Promise<void> {
  const db = await getDB();
  await db.put('tasks', { key: task.id, value: task });
}

export async function updateTask(task: ImageTask): Promise<void> {
  await addTask(task); // put() upserts
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

export async function clearTasks(): Promise<void> {
  const db = await getDB();
  await db.clear('tasks');
}

// KV store (form state, batch ID)
export async function getKV<K extends KVKey>(key: K): Promise<KVValueMap[K] | undefined> {
  const db = await getDB();
  const record = await db.get('kv', key);
  return record?.value as KVValueMap[K] | undefined;
}

export async function setKV<K extends KVKey>(key: K, value: KVValueMap[K]): Promise<void> {
  const db = await getDB();
  await db.put('kv', { key, value } as { key: KVKey; value: KVValueMap[KVKey] });
}

export async function deleteKV<K extends KVKey>(key: K): Promise<void> {
  const db = await getDB();
  await db.delete('kv', key);
}

// Storage persistence request
export async function requestPersistence(): Promise<boolean> {
  if (navigator.storage?.persist) {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  }
  return false;
}
