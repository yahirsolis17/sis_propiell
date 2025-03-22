import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        // Configuración para JS
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        // Configuración para fuentes
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".woff2") || assetInfo.name.endsWith(".woff")) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  },
  // Optimización para Vercel
  base: "/",
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