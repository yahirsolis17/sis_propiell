import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // Cambia a "/" para producción (las rutas relativas pueden afectar la carga de assets)
  build: {
    outDir: "dist", // Carpeta donde se genera el build
  },
  // Aseguramos que se incluyan las fuentes .woff y .woff2
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
