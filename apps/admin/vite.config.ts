import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("apps/admin"),
  plugins: [
    react(),
    tsconfigPaths({ projects: [resolve("tsconfig.base.json")] }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4200,
    proxy: { "/api": "http://localhost:4000" },
  },
  build: { outDir: resolve("dist/apps/admin"), emptyOutDir: true },
});
