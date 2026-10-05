/*
 * Intent: Simplified header with BYOK status indicator + hamburger menu (2026-10-06 R1)
 * Shows connection status (dot + text, both locales), opens settings on click
 */

import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
}

export function Header({ onOpenMenu, onOpenSettings, isConnected }: HeaderProps) {
  const { t } = useTranslation();
  const statusText = isConnected
    ? t("header.status.connected")
    : t("header.status.notConnected");

  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-heading font-semibold text-text-primary">
          OpenAI Image WebUI
        </h1>
        <p className="text-detail text-text-secondary">{t("header.subtitle")}</p>
      </div>
      <div className="flex items-center gap-2">
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
