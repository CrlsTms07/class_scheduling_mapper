import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // The API only accepts this address, so it fails loudly if 5173 is taken.
  server: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.js",
    include: ["src/**/*.test.js"],
  },
});
