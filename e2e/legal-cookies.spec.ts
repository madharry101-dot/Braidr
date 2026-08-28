import { test, expect } from "@playwright/test";

// B2 — cookie banner (GDPR-03) and the published legal pages.

test.describe("cookie banner (GDPR-03)", () => {
  test("shows on first visit, remembers the choice, reopens from the footer", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByText("Cookies, kept simple");
    await expect(banner).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Essential only" })).toBeVisible();

    await page.getByRole("button", { name: "Essential only" }).click();
    await expect(banner).toBeHidden();

    // Choice persists across a reload.
    await page.reload();
    await expect(page.getByText("Cookies, kept simple")).toBeHidden();

    // Footer "Cookie preferences" brings it back.
    await page.getByRole("button", { name: "Cookie preferences" }).click();
    await expect(page.getByText("Cookies, kept simple")).toBeVisible();
  });
});

test.describe("legal pages are published (not placeholders)", () => {
  test("/terms and /privacy carry real content + a draft notice", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByText("Draft — pending legal review")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Limitation of Liability/ })).toBeVisible();
    await expect(page.getByText(/Placeholder/)).toHaveCount(0);

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Special Category Data/ })).toBeVisible();
    await expect(page.getByText(/Placeholder/)).toHaveCount(0);
  });
});
