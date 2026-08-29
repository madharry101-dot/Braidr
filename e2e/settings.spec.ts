import { test, expect } from "@playwright/test";

// B6 — Settings shell + the /account -> /settings fold.

test("/account redirects to /settings (server-side)", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/(settings|login)/);
});

test("/settings unauthenticated lands on a working login form", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
