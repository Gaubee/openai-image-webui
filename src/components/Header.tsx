/*
 * Intent: Simplified header with hamburger menu trigger (2026-10-05)
 * Minimal chrome - logo + subtitle + menu button only
 */

import { Menu } from "lucide-react";

interface HeaderProps {
  onOpenMenu: () => void;
}

export function Header({ onOpenMenu }: HeaderProps) {
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
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded p-2 text-text-secondary transition hover:bg-surface-1 hover:text-text-primary"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
    </header>
  );
}
