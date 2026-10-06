import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
 * Intent: vite config for OUR webapp UI (2026-10-06 dual-UI split)
 * Upstream-original UI keeps the repo root (index.html + src/); this config
 * serves webapp/ as its own root so the webapp UI lives at "/" of its own
 * server/port. No publicDir: the upstream PWA service worker must not cache
 * the webapp.
 */
export default defineConfig({
  base: "/",
  plugins: [react()],
  publicDir: false,
  // Non-default fallback port; `portless` owns routing when wrapped (pnpm dev:webapp)
  server: { port: 4827, strictPort: false },
});
