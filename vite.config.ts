import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  // Non-default fallback port (5173 caused recurring conflicts). When run
  // through `portless` (pnpm dev), the https://<name>.localhost proxy owns
  // routing and this port is just the private upstream.
  server: { port: 4826, strictPort: false },
});
