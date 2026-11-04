import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end flows against the running app with the seeded demo data.
 * Start the app first (npm run dev) with DEMO_MODE=true and the seed loaded.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      // A phone-sized screen: the patient side is built for 360 to 390 px.
      name: "phone",
      testMatch: /patient\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chromium" },
    },
    {
      name: "desk",
      testMatch: /desk\.spec\.ts/,
      use: { viewport: { width: 1280, height: 900 }, channel: "chromium" },
    },
  ],
});
