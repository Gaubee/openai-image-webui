/*
 * Intent: Settings state management with IndexedDB persistence (2026-10-05)
 * Original requirement: Migrate from localStorage to IDB, preserve user settings
 */

import { useState, useEffect } from "react";
import { getSettings, setSettings as saveSettingsIDB } from "../lib/storageNew";
import { sanitizeSettings, DEFAULT_SETTINGS } from "../lib/storage";
import type { AppSettings } from "../types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then((stored) => {
      setSettings(stored ? sanitizeSettings(stored) : DEFAULT_SETTINGS);
      setLoaded(true);
    }).catch(() => {
      setSettings(DEFAULT_SETTINGS);
      setLoaded(true);
    });
  }, []);

  function updateSettings(next: Partial<AppSettings>) {
    const updated = sanitizeSettings({ ...settings, ...next });
    setSettings(updated);
    saveSettingsIDB(updated).catch((error) => {
      console.error('Failed to save settings to IDB:', error);
    });
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
    saveSettingsIDB(DEFAULT_SETTINGS).catch((error) => {
      console.error('Failed to reset settings in IDB:', error);
    });
  }

  return {
    settings,
    setSettings: updateSettings,
    resetSettings,
    loaded,
  };
}
