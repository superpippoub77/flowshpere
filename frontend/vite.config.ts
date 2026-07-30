import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativo: funziona a prescindere da dove viene depositata la cartella
// sul server (radice, sottocartella, se viene spostata domani, ecc.) perche'
// il routing dell'app usa gli hash (#/...) e la pagina fisica non cambia mai.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // php -S localhost:8000 api.php (vedi backend-php/README.md)
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
