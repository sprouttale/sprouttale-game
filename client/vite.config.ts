import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy WebSocket connections to the Colyseus server during development.
    // This avoids CORS issues — all traffic goes through the same origin.
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
    },
  },
  // Ensure Phaser can access global 'window' without issues
  define: {
    global: "globalThis",
  },
});
