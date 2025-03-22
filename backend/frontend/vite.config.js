import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist", // 👈 asegura que se compile ahí
  },
  base: "./", // 👈 necesario si usas rutas relativas en React
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000", // solo para desarrollo local
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
