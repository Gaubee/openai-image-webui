/*
 * Intent: app-shell topbar — single fixed row, chrome not content (2026-10-06 R11)
 * The webapp redesign demotes the old two-line header: title is compact,
 * tool entries are icon-only with tooltips, status stays one glance away.
 */

import { Eye, Images, PenLine, Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  onOpenVision: () => void;
  onOpenRename: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  hasTasks: boolean;
  onClearTasks: () => void;
}

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary";

export function Header({
  onOpenVision,
  onOpenRename,
  onOpenLibrary,
  onOpenSettings,
  isConnected,
  hasTasks,
  onClearTasks,
}: HeaderProps) {
  const { t } = useTranslation();
  const statusText = isConnected ? t("header.status.connected") : t("header.status.notConnected");

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-surface-2 px-3">
      {/* text-sm! out-ranks the unlayered h1 display rule in index.css */}
      <h1 className="mr-2 whitespace-nowrap text-sm! font-semibold text-text-primary" title={t("header.subtitle")}>
        {t("header.title")}
      </h1>

      <div className="ml-auto flex items-center gap-0.5">
        <button type="button" onClick={onOpenVision} className={iconButton} aria-label={t("workspace.modes.vision")} title={t("workspace.modes.vision")}>
          <Eye className="h-4.5 w-4.5" />
        </button>
        <button type="button" onClick={onOpenRename} className={iconButton} aria-label={t("workspace.modes.rename")} title={t("workspace.modes.rename")}>
          <PenLine className="h-4.5 w-4.5" />
        </button>
        <button type="button" onClick={onOpenLibrary} className={iconButton} aria-label={t("library.title")} title={t("library.title")}>
          <Images className="h-4.5 w-4.5" />
        </button>

        <div className="mx-1.5 h-5 w-px bg-surface-3" aria-hidden />

        <button
          type="button"
          onClick={onClearTasks}
          disabled={!hasTasks}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-1 hover:text-error disabled:cursor-not-allowed disabled:text-text-tertiary disabled:hover:bg-transparent"
          aria-label={t("headerExtras.clearTasks")}
          title={t("headerExtras.clearTasks")}
        >
          <Trash2 className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex h-9 items-center gap-1.5 rounded px-2 transition-colors hover:bg-surface-1"
          title={statusText}
        >
          <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-success" : "bg-text-tertiary"}`} aria-hidden />
          <span className="hidden whitespace-nowrap text-[11px] text-text-secondary min-[420px]:inline">{statusText}</span>
        </button>

        <button type="button" onClick={onOpenSettings} className={iconButton} aria-label={t("settings.title")} title={t("settings.title")}>
          <Settings className="h-4.5 w-4.5" />
        </button>
      </div>
    </header>
  );
}
