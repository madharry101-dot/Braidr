import { defineConfig, devices } from "@playwright/test";

// TRD 8.1: E2E covers all P1 critical paths, plus responsive layout on 3
// viewport sizes. Projects below are seeded now; specs land alongside each
// feature (booking flow, BraidCare session, Pro Step 2) as they're built.
const againstDeployPreview = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // The local dev server compiles routes on first hit; a cold parallel run
  // can exceed the 30s default. A deploy-preview target serves instantly.
  timeout: againstDeployPreview ? 30_000 : 90_000,
  workers: againstDeployPreview ? undefined : 2,
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
  // Only manage a dev server when testing locally; CI points
  // PLAYWRIGHT_BASE_URL at the Netlify deploy preview.
  webServer: againstDeployPreview
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
