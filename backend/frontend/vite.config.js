import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    cssMinify: false, // Desactiva minificación CSS temporalmente
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Mantén nombres originales para fuentes
          if (assetInfo.name.endsWith(".woff2") || assetInfo.name.endsWith(".woff")) {
            return "assets/[name][extname]";
          }
          // Hashea otros assets
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  },
  assetsInclude: ["**/*.woff", "**/*.woff2"],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});