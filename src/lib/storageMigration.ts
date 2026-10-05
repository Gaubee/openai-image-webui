/*
 * Intent: One-time migration from localStorage to IndexedDB (2026-10-05)
 * Original requirement: Preserve existing user data, no data loss
 *
 * Flow: Detect localStorage keys → import to IDB → delete localStorage only after success
 * Physical isolation: Legacy localStorage readers live only here; since
 * 2026-10-06 this module runs from the main.tsx bootstrap (before first render),
 * not from App.tsx.
 */

import { loadSettings, loadTasks, loadBatchPrompts, STORAGE_KEYS } from './storage';
import { setSettings, addTask, setKV } from './storageNew';

const MIGRATION_FLAG_KEY = 'openai-image-webui:migrated-to-idb';

export async function shouldRunMigration(): Promise<boolean> {
  // Already migrated
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    return false;
  }

  // Check if any old data exists
  const hasSettings = localStorage.getItem(STORAGE_KEYS.settings) !== null;
  const hasTasks = localStorage.getItem(STORAGE_KEYS.tasks) !== null;
  const hasBatchPrompts = localStorage.getItem(STORAGE_KEYS.batchPrompts) !== null;

  return hasSettings || hasTasks || hasBatchPrompts;
}

export async function runMigration(): Promise<{ success: boolean; error?: string }> {
  try {
    // Load all data from localStorage
    const settings = loadSettings();
    const tasks = loadTasks();
    const batchPrompts = loadBatchPrompts();

    // Import to IndexedDB
    await setSettings(settings);

    for (const task of tasks) {
      await addTask(task);
    }

    if (batchPrompts) {
      await setKV('lastBatchPrompts', batchPrompts);
    }

    // Only delete localStorage after successful IDB write
    localStorage.removeItem(STORAGE_KEYS.settings);
    localStorage.removeItem(STORAGE_KEYS.tasks);
    localStorage.removeItem(STORAGE_KEYS.batchPrompts);

    // Mark migration complete
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
