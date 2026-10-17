import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em desenvolvimento, API em :8000 e front em :5173 (proxy evita CORS e mantém cookies).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
  build: { sourcemap: false, target: "es2020" },
});
