import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // Habilita minificación CSS (pero con precaución)
    cssMinify: process.env.NODE_ENV === "production",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".woff2") || assetInfo.name.endsWith(".woff")) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        // Añade esto para CSS
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        // Genera manifest.json para debug
        manualChunks: undefined,
      }
    }
  },
  // Base path crítico para Vercel
  base: "/",
  assetsInclude: ["**/*.woff", "**/*.woff2"],
  server: { /* ... configuración proxy ... */ }
});