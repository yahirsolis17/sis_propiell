import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",  // Directorio para assets
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]"  // Estructura de archivos
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