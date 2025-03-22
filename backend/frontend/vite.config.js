import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    cssMinify: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".woff2") || assetInfo.name.endsWith(".woff")) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        // Nuevas líneas para módulos ES
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        format: "esm"
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