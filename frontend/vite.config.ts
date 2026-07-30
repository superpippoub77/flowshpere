import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In produzione l'app non vive alla radice del dominio ma in una sottocartella
// (es. /projects/flowshpere/), quindi il base path va passato a build time -
// altrimenti gli asset generati puntano a "/assets/..." (radice del dominio)
// invece che "/projects/flowshpere/assets/..." e il browser li trova 404.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // php -S localhost:8000 api.php (vedi backend-php/README.md)
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
