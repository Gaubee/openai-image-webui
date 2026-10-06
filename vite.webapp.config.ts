import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
 * Intent: vite config for OUR webapp UI (2026-10-06 dual-UI split)
 * Upstream-original UI keeps the repo root (index.html + src/); this config
 * serves webapp/ as its own root so the webapp UI lives at "/" of its own
 * server/port. publicDir points at webapp/public (its own manifest + icons) —
 * never the repo-root public/, whose PWA service worker must not reach the
 * webapp origin.
 */
export default defineConfig({
  root: "webapp",
  base: "/",
  plugins: [react()],
  publicDir: "public",
  // Both dev servers run from the same repo — keep their dep-optimizer
  // caches separate or they corrupt each other's pre-bundles on startup.
  cacheDir: "node_modules/.vite-webapp",
  // Non-default fallback port; `portless` owns routing when wrapped (pnpm dev:webapp)
  server: {
    port: 4827,
    strictPort: false,
    // Deps are pre-bundled into the repo-root node_modules — /@fs references
    // there must stay servable even though the vite root is webapp/.
    // ".." is relative to the vite root (webapp/) and resolves to the repo root.
    fs: { allow: [".."] },
  },
});
