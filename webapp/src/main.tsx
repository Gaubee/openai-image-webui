import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { shouldRunMigration, runMigration } from "./lib/storageMigration";
import { requestPersistence } from "./lib/storageNew";
import { reportStorageIssue } from "./lib/storageHealth";
import "./i18n";
import "./index.css";

/*
 * Intent: app entry (2026-10-05, amended 2026-10-06)
 * - SW registration is PROD-only: in dev the precached bundle poisons iteration
 *   (edited source never reaches the page until the SW is unregistered).
 * - Storage migration is a bootstrap phase that completes BEFORE the first
 *   render, so every hook reads post-migration IndexedDB (no mount race).
 *   Migration failure surfaces through storageHealth once the app mounts (the
 *   banner reads issues reported before mount); old localStorage keys are kept
 *   for an automatic retry next launch.
 */
// No service worker here: the upstream PWA (public/sw.js) belongs to the
// upstream UI and must not control the webapp origin paths.

const root = ReactDOM.createRoot(document.getElementById("root")!);

async function bootstrap() {
  try {
    if (await shouldRunMigration()) {
      const result = await runMigration();
      if (!result.success) {
        console.error("[bootstrap] storage migration failed:", result.error);
        reportStorageIssue("migrationFailed", result.error);
      }
    }
  } catch (error) {
    console.error("[bootstrap] storage migration threw:", error);
    reportStorageIssue("migrationFailed", error);
  }
  void requestPersistence().catch(() => {});
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
