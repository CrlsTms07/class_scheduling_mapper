// @ts-check
/**
 * End-to-end tests: a real browser against a running API and app.
 * E2E_APP is the app's address (default http://localhost:5173). They use the installed Chrome.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 12_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_APP ?? "http://localhost:5173",
    channel: "chrome",
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
  },
});
