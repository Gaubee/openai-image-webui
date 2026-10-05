/*
 * Intent: Task persistence helpers for IDB integration (2026-10-05)
 * Replaces localStorage saveTasks with incremental IDB writes
 */

import type { ImageTask } from "../types";
import { updateTask as updateTaskIDB } from "./storageNew";

/**
 * Persists a single task update to IndexedDB.
 * Replaces the old localStorage batch-save pattern.
 */
export async function persistTask(task: ImageTask): Promise<void> {
  try {
    await updateTaskIDB(task);
  } catch (error) {
    console.error('Failed to persist task to IDB:', error);
  }
}
