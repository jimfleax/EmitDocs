/**
 * @file vite.config.ts
 * @description Vite bundler configuration for EmitDocs frontend application.
 * @architecture Sets up plugins for TanStack Router, React Fast Refresh, path aliases, and /api dev proxy.
 * @agent_note TanStackRouterVite generates src/routeTree.gen.ts automatically on route changes.
 */

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
