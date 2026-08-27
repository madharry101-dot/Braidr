import { defineConfig, devices } from "@playwright/test";

// TRD 8.1: E2E covers all P1 critical paths, plus responsive layout on 3
// viewport sizes. Projects below are seeded now; specs land alongside each
// feature (booking flow, BraidCare session, Pro Step 2) as they're built.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile-iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "tablet-ipad-air", use: { ...devices["iPad (gen 7)"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
