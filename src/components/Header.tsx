/*
 * Intent: Simplified header with BYOK status indicator + hamburger menu (2026-10-06 R1)
 * Shows connection status (dot + text), opens settings on click
 */

import { Menu } from "lucide-react";

interface HeaderProps {
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
}

export function Header({ onOpenMenu, onOpenSettings, isConnected }: HeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-heading font-semibold text-text-primary">
          OpenAI Image WebUI
        </h1>
        <p className="text-detail text-text-secondary">
          Pure frontend BYOK image generation
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
          title={isConnected ? "API connected" : "API not configured"}
        >
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-success" : "bg-text-tertiary"}`}
            aria-hidden
          />
          <span className="hidden sm:inline">{isConnected ? "Connected" : "Not connected"}</span>
        </button>
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded p-2 text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}
