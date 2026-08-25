import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  build: {
    // AudioWorklet module in public/ must stay a plain JS file served at /worklets/
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
