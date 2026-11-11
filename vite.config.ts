import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: {
    // The full Lucide icon library is lazy-loaded as its own chunk.
    chunkSizeWarningLimit: 1600,
  },
});
