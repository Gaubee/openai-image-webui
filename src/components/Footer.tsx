/*
 * Intent: Footer with language switcher (2026-10-05)
 * Minimal footer at bottom of page
 */

import { LanguageSwitcher } from "./LanguageSwitcher";

export function Footer() {
  return (
    <footer className="mt-12 flex items-center justify-between border-t border-surface-2 pt-6">
      <a
        href="https://github.com/tobenot/openai-image-webui"
        target="_blank"
        rel="noreferrer"
        className="text-detail text-text-tertiary transition hover:text-text-secondary"
      >
        GitHub
      </a>
      <LanguageSwitcher />
    </footer>
  );
}
