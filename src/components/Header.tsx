/*
 * Intent: header with BYOK connection status, clear-tasks, settings entry (2026-10-06 R1, R5 2026-10-06)
 * Original requirement: BYOK status visible at a glance (critic persona walk);
 * clear-tasks entry restored after Codex R2 flagged its disappearance
 */

import { Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  hasTasks: boolean;
  onClearTasks: () => void;
}

export function Header({ onOpenMenu, onOpenSettings, isConnected, hasTasks, onClearTasks }: HeaderProps) {
  const { t } = useTranslation();
  const statusText = isConnected
    ? t("header.status.connected")
    : t("header.status.notConnected");

  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-heading font-semibold text-text-primary">
          {t("header.title")}
        </h1>
        <p className="text-detail text-text-secondary">{t("header.subtitle")}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onClearTasks}
          disabled={!hasTasks}
          className="rounded p-2 text-text-secondary transition-colors hover:bg-surface-1 hover:text-error disabled:cursor-not-allowed disabled:text-text-tertiary disabled:hover:bg-transparent"
          aria-label={t("headerExtras.clearTasks")}
          title={t("headerExtras.clearTasks")}
        >
          <Trash2 className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
          title={statusText}
        >
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-success" : "bg-text-tertiary"}`}
            aria-hidden
          />
          <span className="text-[11px] sm:text-xs">{statusText}</span>
        </button>
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded p-2 text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
          aria-label={t("settings.title")}
          title={t("settings.title")}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
