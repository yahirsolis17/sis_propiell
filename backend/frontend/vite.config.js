import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        // Mantén nombres originales para fuentes
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".woff2") || assetInfo.name.endsWith(".woff")) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  },
  assetsInclude: ["**/*.woff", "**/*.woff2"]
});